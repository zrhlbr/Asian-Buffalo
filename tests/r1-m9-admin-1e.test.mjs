import assert from "node:assert/strict";
import test from "node:test";

process.env.AB_ALLOW_TEST_IDENTITY = "1";

import { createTestDb } from "./db-helper.mjs";
import { handleAdminApi } from "../lib/admin/admin-api.ts";
import {
  ensureAdminBootstrap,
  resetAdminBootstrapCacheForTests,
} from "../lib/admin/admin-bootstrap.ts";
import { ADMIN_I18N, ADMIN_LOCALES } from "../lib/admin/i18n.ts";
import { roleHasPermission } from "../lib/admin/admin-auth.ts";
import { resetDashboardCacheForTests } from "../lib/admin/admin-queries.ts";

function adminRequest(path, { method = "GET", token, body } = {}) {
  const headers = {
    "content-type": "application/json",
    "cf-connecting-ip": "10.0.0.9",
    "x-request-id": "req-test-1e",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(`http://admin.test/api/admin/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function slugOf(path) {
  return path.split("?")[0].split("/").filter(Boolean);
}

async function callAdmin(db, path, options) {
  const response = await handleAdminApi(db, adminRequest(path, options), slugOf(path));
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

async function freshDb() {
  resetAdminBootstrapCacheForTests();
  resetDashboardCacheForTests();
  const { db, sqlite } = createTestDb();
  await ensureAdminBootstrap(db);
  return { db, sqlite };
}

async function login(db) {
  return callAdmin(db, "login", { method: "POST", body: { username: "admin", password: "admin123" } });
}

test("ADMIN-1E i18n key parity ZH/EN/MY", () => {
  const zhKeys = Object.keys(ADMIN_I18N.zh).sort();
  for (const locale of ADMIN_LOCALES) {
    assert.deepEqual(Object.keys(ADMIN_I18N[locale]).sort(), zhKeys, `locale ${locale}`);
  }
  for (const key of ["risk.tab.overview", "risk.markResolved", "audit.immutableHint", "audit.securityLogs"]) {
    assert.ok(ADMIN_I18N.zh[key], key);
  }
});

test("ADMIN-1E RBAC risk manage / view", () => {
  assert.equal(roleHasPermission("RISK", "risk:view"), true);
  assert.equal(roleHasPermission("RISK", "risk:manage"), true);
  assert.equal(roleHasPermission("FINANCE", "risk:view"), true);
  assert.equal(roleHasPermission("FINANCE", "risk:manage"), false);
  assert.equal(roleHasPermission("SUPPORT", "risk:view"), false);
  assert.equal(roleHasPermission("AUDIT", "logs:view"), true);
});

test("ADMIN-1E auth gates + overview + events", async () => {
  const { db, sqlite } = await freshDb();
  assert.equal((await callAdmin(db, "risk/overview")).status, 401);

  sqlite
    .prepare(`INSERT INTO players (id, wallet_adapter_ref, currency, status) VALUES ('p-risk', 'w-p-risk', 'MMK', 'ACTIVE')`)
    .run();
  sqlite
    .prepare(
      `INSERT INTO game_math_versions (id, sha256, status, config_json) VALUES ('mv1', 'sha', 'FROZEN', '{}')`,
    )
    .run();
  sqlite
    .prepare(
      `INSERT INTO game_sessions (id, player_id, math_version_id, status, currency, free_games_remaining, expires_at)
       VALUES ('s1', 'p-risk', 'mv1', 'OPEN', 'MMK', 0, strftime('%Y-%m-%d %H:%M:%S', 'now', '+1 hour'))`,
    )
    .run();
  // Reliable signal: abnormal bet (>= 1_000_000 minor).
  sqlite
    .prepare(
      `INSERT INTO game_rounds
        (id, session_id, player_id, math_version_id, idempotency_key, request_hash, status, currency,
         total_bet_minor, total_win_minor, wallet_applied, created_at)
       VALUES ('r-ab', 's1', 'p-risk', 'mv1', 'idem-ab', 'hash-ab', 'SETTLED', 'MMK',
               2000000, 0, 1, strftime('%Y-%m-%d %H:%M:%S', 'now'))`,
    )
    .run();
  // High-frequency: 30+ rounds today.
  for (let i = 0; i < 32; i++) {
    sqlite
      .prepare(
        `INSERT INTO game_rounds
          (id, session_id, player_id, math_version_id, idempotency_key, request_hash, status, currency,
           total_bet_minor, total_win_minor, wallet_applied, created_at)
         VALUES (?, 's1', 'p-risk', 'mv1', ?, ?, 'SETTLED', 'MMK', 100, 0, 1,
                 strftime('%Y-%m-%d %H:%M:%S', 'now'))`,
      )
      .run(`r-${i}`, `idem-${i}`, `hash-${i}`);
  }

  const loginRes = await login(db);
  assert.equal(loginRes.status, 200);
  const token = loginRes.data.token;

  const overview = await callAdmin(db, "risk/overview", { token });
  assert.equal(overview.status, 200);
  assert.equal(overview.data.moneyGate.gate, "CLOSED");
  assert.ok(overview.data.metrics.openEvents.availability);
  assert.ok(overview.data.capabilities.GAMEPLAY);
  assert.equal(overview.data.csvExport, "FUTURE");

  const events = await callAdmin(db, "risk/events?playerId=p-risk&pageSize=50", { token });
  assert.equal(events.status, 200);
  assert.ok(events.data.total >= 1, JSON.stringify(events.data.items.map((e) => e.type)));
  const target =
    events.data.items.find((e) => e.type === "ABNORMAL_BET") ||
    events.data.items.find((e) => e.type === "HIGH_FREQ_SPIN");
  assert.ok(target, JSON.stringify(events.data.items.map((e) => e.type)));
  assert.equal(target.status, "OPEN");
  assert.equal(target.category, "GAMEPLAY");

  const detail = await callAdmin(db, `risk/events/${target.id}`, { token });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.autoActions.freezePlayer, false);

  const badTransition = await callAdmin(db, `risk/events/${target.id}/status`, {
    token,
    method: "POST",
    body: { status: "RESOLVED" },
  });
  assert.equal(badTransition.status, 400);

  const reviewing = await callAdmin(db, `risk/events/${target.id}/status`, {
    token,
    method: "POST",
    body: { status: "REVIEWING", reason: "manual review start" },
  });
  assert.equal(reviewing.status, 200);
  assert.equal(reviewing.data.event.status, "REVIEWING");
  assert.equal(reviewing.data.autoActions.freeze, false);

  const note = await callAdmin(db, `risk/events/${target.id}/notes`, {
    token,
    method: "POST",
    body: { note: "internal evidence note" },
  });
  assert.equal(note.status, 200);

  const resolved = await callAdmin(db, `risk/events/${target.id}/status`, {
    token,
    method: "POST",
    body: { status: "RESOLVED", reason: "false positive after review" },
  });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.data.event.status, "RESOLVED");

  const player = await callAdmin(db, "risk/players/p-risk", { token });
  assert.equal(player.status, 200);
  assert.ok(Array.isArray(player.data.events));
});

test("ADMIN-1E audit center fields + immutability + security NA", async () => {
  const { db } = await freshDb();
  const loginRes = await login(db);
  const token = loginRes.data.token;

  const adminLogs = await callAdmin(db, "logs/admin?page=1&pageSize=20", { token });
  assert.equal(adminLogs.status, 200);
  assert.equal(adminLogs.data.immutable, true);
  assert.equal(adminLogs.data.export, "FUTURE");
  assert.equal(adminLogs.data.sources.adminLoginFailure, "NOT_AVAILABLE");
  assert.ok(adminLogs.data.items.some((row) => row.action === "admin.login"));
  const loginRow = adminLogs.data.items.find((row) => row.action === "admin.login");
  assert.ok("request_id" in loginRow || loginRow.request_id === null || loginRow.request_id);

  const security = await callAdmin(db, "logs/security", { token });
  assert.equal(security.status, 200);
  assert.equal(security.data.availability.adminLoginFailures, "NOT_AVAILABLE");
  assert.equal(security.data.immutable, true);

  // No delete endpoint
  const del = await callAdmin(db, "logs/admin/x", { token, method: "POST", body: { reason: "x" } });
  assert.ok([404, 405, 400].includes(del.status));
});

test("ADMIN-1E money integrity consumed into risk (no second model)", async () => {
  const { db, sqlite } = await freshDb();
  sqlite
    .prepare(`INSERT INTO players (id, wallet_adapter_ref, currency, status) VALUES ('p-mi', 'w-mi', 'MMK', 'ACTIVE')`)
    .run();
  sqlite
    .prepare(
      `INSERT INTO ledger_accounts (id, player_id, kind, currency, balance_minor, version)
       VALUES ('acc-neg', 'p-mi', 'PLAYER_AVAILABLE', 'MMK', -100, 1)`,
    )
    .run();
  const loginRes = await login(db);
  const token = loginRes.data.token;
  const events = await callAdmin(db, "risk/events?category=LEDGER&playerId=p-mi", { token });
  assert.equal(events.status, 200);
  assert.ok(events.data.items.some((e) => e.type === "ABNORMAL_BALANCE" || e.type === "NEGATIVE_BALANCE"));
});

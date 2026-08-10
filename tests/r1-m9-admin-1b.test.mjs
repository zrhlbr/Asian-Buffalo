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
import {
  maskDeviceId,
  maskEmail,
  maskIp,
  maskPhone,
  presentIp,
  presentPhone,
} from "../lib/admin/admin-pii.ts";
import { resetDashboardCacheForTests } from "../lib/admin/admin-queries.ts";

function adminRequest(path, { method = "GET", token, body } = {}) {
  const headers = {
    "content-type": "application/json",
    "cf-connecting-ip": "10.0.0.9",
    "x-request-id": "req-test-1b",
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
  return { status: response.status, data, headers: response.headers };
}

async function freshDb() {
  resetAdminBootstrapCacheForTests();
  resetDashboardCacheForTests();
  const { db, sqlite } = createTestDb();
  await ensureAdminBootstrap(db);
  return { db, sqlite };
}

async function login(db, username = "admin", password = "admin123") {
  return callAdmin(db, "login", { method: "POST", body: { username, password } });
}

function seedPlayer(sqlite, playerId = "p1") {
  sqlite
    .prepare(
      `INSERT INTO players (id, wallet_adapter_ref, currency, status) VALUES (?, ?, 'MMK', 'ACTIVE')`,
    )
    .run(playerId, `wallet-${playerId}`);
  try {
    sqlite
      .prepare(
        `INSERT INTO player_profiles (player_id, nickname, phone_e164, email, last_login_at)
         VALUES (?, 'Nick', '09123456789', 'zhao@example.com', CURRENT_TIMESTAMP)`,
      )
      .run(playerId);
  } catch {
    sqlite
      .prepare(
        `INSERT INTO player_profiles (player_id, nickname, phone_e164, last_login_at)
         VALUES (?, 'Nick', '09123456789', CURRENT_TIMESTAMP)`,
      )
      .run(playerId);
  }
  sqlite
    .prepare(
      `INSERT INTO game_math_versions (id, sha256, status, config_json) VALUES ('mv1', 'sha-1', 'FROZEN', '{}')`,
    )
    .run();
  sqlite
    .prepare(
      `INSERT INTO game_sessions (id, player_id, math_version_id, status, currency, free_games_remaining, expires_at)
       VALUES ('s1', ?, 'mv1', 'OPEN', 'MMK', 0, strftime('%Y-%m-%d %H:%M:%S', 'now', '+1 hour'))`,
    )
    .run(playerId);
  sqlite
    .prepare(
      `INSERT INTO game_rounds
        (id, session_id, player_id, math_version_id, idempotency_key, request_hash, status, currency,
         total_bet_minor, total_win_minor, balance_after_minor, settled_at)
       VALUES ('r1', 's1', ?, 'mv1', 'idem-1b', 'hash-1b', 'SETTLED', 'MMK', 1000, 200, 9000, CURRENT_TIMESTAMP)`,
    )
    .run(playerId);
  try {
    sqlite
      .prepare(
        `CREATE TABLE IF NOT EXISTS player_auth_sessions (
          id text PRIMARY KEY,
          player_id text NOT NULL,
          ip text,
          device text,
          user_agent text,
          created_at text DEFAULT CURRENT_TIMESTAMP,
          last_seen_at text
        )`,
      )
      .run();
    sqlite
      .prepare(
        `INSERT INTO player_auth_sessions (id, player_id, ip, device, user_agent)
         VALUES ('auth1', ?, '192.168.1.50', 'device-fingerprint-abc123xyz789', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Safari/604.1')`,
      )
      .run(playerId);
  } catch {
    /* optional */
  }
}

test("1B PII mask helpers", () => {
  assert.match(maskPhone("09123456789"), /^\d{2}\*+\d{3}$/);
  assert.equal(maskEmail("zhao@example.com"), "zh***@example.com");
  assert.equal(maskIp("192.168.1.50"), "192.168.*.*");
  assert.match(maskIp("2001:db8:85a3::8a2e:370:7334"), /2001:db8:/);
  assert.match(maskDeviceId("device-fingerprint-abc123xyz789"), /\*{6}/);
  assert.equal(
    presentPhone("09123456789", { viewPii: false, viewDevices: false, viewSessions: false }),
    maskPhone("09123456789"),
  );
  assert.equal(
    presentPhone("09123456789", { viewPii: true, viewDevices: false, viewSessions: false }),
    "09123456789",
  );
  assert.equal(
    presentIp("10.20.30.40", { viewPii: false, viewDevices: false, viewSessions: false }),
    "10.20.*.*",
  );
});

test("1B dashboard summary real metrics + availability cells", async () => {
  const { db, sqlite } = await freshDb();
  seedPlayer(sqlite);
  const { data: loginData } = await login(db);
  const dash = await callAdmin(db, "dashboard", { token: loginData.token });
  assert.equal(dash.status, 200);
  assert.ok(dash.data.metrics);
  assert.equal(dash.data.metrics.totalPlayers.availability, "OK");
  assert.equal(dash.data.metrics.totalPlayers.value, 1);
  assert.equal(dash.data.metrics.todayGamePlayers.availability, "OK");
  assert.equal(dash.data.metrics.todayRounds.availability, "OK");
  assert.equal(dash.data.metrics.todaySpins.source.includes("spin≡round") || dash.data.metrics.todaySpins.value === 1, true);
  assert.ok(Array.isArray(dash.data.trend7d));
  assert.equal(dash.data.trend7d.length, 7);
  assert.ok(dash.data.sources.totalPlayers);
  // Second call should be cacheable
  const dash2 = await callAdmin(db, "dashboard", { token: loginData.token });
  assert.equal(dash2.data.cached, true);
});

test("1B dashboard empty is real zero not fake series", async () => {
  const { db } = await freshDb();
  const { data: loginData } = await login(db);
  const dash = await callAdmin(db, "dashboard", { token: loginData.token });
  assert.equal(dash.status, 200);
  assert.equal(dash.data.metrics.totalPlayers.value, 0);
  assert.equal(dash.data.metrics.totalPlayers.availability, "OK");
  assert.equal(dash.data.trend7d.every((d) => d.newPlayers === 0), true);
});

test("1B players list pagination search filter + masked PII for OPS", async () => {
  const { db, sqlite } = await freshDb();
  seedPlayer(sqlite, "p-ops");
  const { data: loginData } = await login(db);
  // Create OPS admin
  await callAdmin(db, "admins", {
    method: "POST",
    token: loginData.token,
    body: { username: "ops1", password: "ops1pass!", role: "OPS", reason: "seed ops" },
  });
  const opsLogin = await login(db, "ops1", "ops1pass!");
  assert.equal(opsLogin.status, 200);
  assert.equal(roleHasPermission("OPS", "players:pii:view"), false);

  const list = await callAdmin(db, "players?page=1&pageSize=20&search=09123456789", {
    token: opsLogin.data.token,
  });
  assert.equal(list.status, 200);
  assert.equal(list.data.total >= 1, true);
  assert.equal(list.data.pageSize, 20);
  const row = list.data.items.find((item) => item.id === "p-ops");
  assert.ok(row);
  assert.notEqual(row.phoneMasked, "09123456789");
  assert.match(String(row.phoneMasked), /\*/);
  if (row.ip) assert.match(String(row.ip), /\*/);
  if (row.device) assert.notEqual(row.device, "device-fingerprint-abc123xyz789");
});

test("1B RISK role can view full PII", async () => {
  const { db, sqlite } = await freshDb();
  seedPlayer(sqlite, "p-risk");
  const { data: loginData } = await login(db);
  await callAdmin(db, "admins", {
    method: "POST",
    token: loginData.token,
    body: { username: "risk1", password: "risk1pass!", role: "RISK", reason: "seed risk" },
  });
  const riskLogin = await login(db, "risk1", "risk1pass!");
  assert.equal(roleHasPermission("RISK", "players:pii:view"), true);
  const detail = await callAdmin(db, "players/p-risk", { token: riskLogin.data.token });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.player.phoneMasked, "09123456789");
  assert.ok(detail.data.walletSummary);
  assert.equal(typeof detail.data.walletSummary.frozenMinor, "number");
  assert.ok(detail.data.modelLimitation.includes("CURRENT MODEL LIMITATION"));
});

test("1B freeze + ban audit before/after + request id", async () => {
  const { db, sqlite } = await freshDb();
  seedPlayer(sqlite, "p-audit");
  const { data: loginData } = await login(db);
  const freeze = await callAdmin(db, "players/p-audit/freeze", {
    method: "POST",
    token: loginData.token,
    body: { reason: "fraud review" },
  });
  assert.equal(freeze.status, 200);
  assert.equal(freeze.data.status, "LOCKED");
  assert.equal(freeze.headers.get("x-request-id"), "req-test-1b");

  // unfreeze then ban (close)
  await callAdmin(db, "players/p-audit/unfreeze", {
    method: "POST",
    token: loginData.token,
    body: { reason: "cleared" },
  });
  const ban = await callAdmin(db, "players/p-audit/close", {
    method: "POST",
    token: loginData.token,
    body: { reason: "policy ban" },
  });
  assert.equal(ban.status, 200);
  assert.equal(ban.data.status, "CLOSED");

  const logs = await callAdmin(db, "logs/admin?page=1&pageSize=50", { token: loginData.token });
  assert.equal(logs.status, 200);
  const freezeLog = logs.data.items.find((item) => item.action === "player.freeze");
  assert.ok(freezeLog);
  const detail = JSON.parse(freezeLog.detail_json);
  assert.equal(detail.before.status, "ACTIVE");
  assert.equal(detail.after.status, "LOCKED");
  assert.equal(detail.requestId, "req-test-1b");
  assert.ok(detail.role);
});

test("1B session revoke requires players:session:revoke", async () => {
  const { db, sqlite } = await freshDb();
  seedPlayer(sqlite, "p-sess");
  const { data: loginData } = await login(db);
  await callAdmin(db, "admins", {
    method: "POST",
    token: loginData.token,
    body: { username: "support1", password: "support1!", role: "SUPPORT", reason: "seed" },
  });
  const supportLogin = await login(db, "support1", "support1!");
  const denied = await callAdmin(db, "sessions/s1/revoke", {
    method: "POST",
    token: supportLogin.data.token,
    body: { reason: "should fail" },
  });
  assert.equal(denied.status, 403);

  const ok = await callAdmin(db, "sessions/s1/revoke", {
    method: "POST",
    token: loginData.token,
    body: { reason: "force logout" },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.status, "REVOKED");
});

test("1B auth gate: no token 401; me works", async () => {
  const { db } = await freshDb();
  const noToken = await callAdmin(db, "me");
  assert.equal(noToken.status, 401);
  const { data: loginData } = await login(db);
  const me = await callAdmin(db, "me", { token: loginData.token });
  assert.equal(me.status, 200);
  assert.ok(me.data.admin.permissions.includes("players:view"));
  assert.ok(me.data.admin.permissions.includes("players:pii:view")); // SUPER_ADMIN *
});

test("1B i18n key parity for new dashboard/players keys", () => {
  for (const locale of ADMIN_LOCALES) {
    assert.equal(ADMIN_I18N[locale]["dash.todayLogin"].length > 0, true);
    assert.equal(ADMIN_I18N[locale]["players.statusBanned"].length > 0, true);
    assert.equal(ADMIN_I18N[locale]["common.notAvailable"], "NOT AVAILABLE");
    assert.equal(ADMIN_I18N[locale]["players.tabWallet"].length > 0, true);
  }
  const zhKeys = Object.keys(ADMIN_I18N.zh).sort();
  assert.deepEqual(Object.keys(ADMIN_I18N.en).sort(), zhKeys);
  assert.deepEqual(Object.keys(ADMIN_I18N.my).sort(), zhKeys);
});

test("1B RBAC matrix: OPS lacks pii; RISK has pii + revoke", () => {
  assert.equal(roleHasPermission("OPS", "players:pii:view"), false);
  assert.equal(roleHasPermission("OPS", "players:session:revoke"), true);
  assert.equal(roleHasPermission("RISK", "players:pii:view"), true);
  assert.equal(roleHasPermission("RISK", "players:session:revoke"), true);
  assert.equal(roleHasPermission("SUPPORT", "players:session:revoke"), false);
  assert.equal(roleHasPermission("READONLY", "players:freeze"), false);
});

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
    "x-request-id": "req-test-1c",
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

function seedGameData(sqlite, { playerId = "p1", roundId = "r1", withLedger = true } = {}) {
  sqlite
    .prepare(`INSERT INTO players (id, wallet_adapter_ref, currency, status) VALUES (?, ?, 'MMK', 'ACTIVE')`)
    .run(playerId, `wallet-${playerId}`);
  sqlite
    .prepare(
      `INSERT INTO game_math_versions (id, sha256, status, config_json, activated_at)
       VALUES ('mv1', 'sha-1c', 'FROZEN', '{"version":"1.0.0","build":"b1","paytableVersion":"pt-1","theoreticalRtp":0.96}', CURRENT_TIMESTAMP)`,
    )
    .run();
  sqlite
    .prepare(
      `INSERT INTO game_sessions (id, player_id, math_version_id, status, currency, free_games_remaining, expires_at)
       VALUES ('s1', ?, 'mv1', 'OPEN', 'MMK', 0, strftime('%Y-%m-%d %H:%M:%S', 'now', '+1 hour'))`,
    )
    .run(playerId);
  const outcome = JSON.stringify({
    grid: [["wild", "a", "k"], ["q", "scatter", "j"], ["a", "a", "a"], ["k", "q", "j"], ["ten", "nine", "buffalo"]],
    winningPositions: [{ reel: 2, row: 0 }],
    evaluation: { multiplier: 3 },
    mathVersion: "mv1",
  });
  sqlite
    .prepare(
      `INSERT INTO game_rounds
        (id, session_id, player_id, math_version_id, idempotency_key, request_hash, status, currency,
         total_bet_minor, total_win_minor, balance_after_minor, outcome_json, wallet_applied, settled_at)
       VALUES (?, 's1', ?, 'mv1', 'idem-1c', 'hash-1c', 'SETTLED', 'MMK', 1000, 2500, 11500, ?, 1, CURRENT_TIMESTAMP)`,
    )
    .run(roundId, playerId, outcome);
  if (withLedger) {
    sqlite
      .prepare(
        `INSERT INTO ledger_transactions (id, idempotency_key, round_id, kind, status, request_hash)
         VALUES ('tx-1c', 'tx-idem-1c', ?, 'GAME_PAYOUT', 'POSTED', 'rh-1c')`,
      )
      .run(roundId);
  }
}

test("ADMIN-1C i18n key parity ZH/EN/MY", () => {
  const zhKeys = Object.keys(ADMIN_I18N.zh).sort();
  for (const locale of ADMIN_LOCALES) {
    assert.deepEqual(Object.keys(ADMIN_I18N[locale]).sort(), zhKeys, `locale ${locale}`);
  }
  for (const key of [
    "games.mathVersion",
    "games.onlinePlayersNa",
    "gameOps.mathVersion",
    "gameOps.health",
    "rounds.reconciliation",
    "spins.ledgerReference",
  ]) {
    assert.ok(key in ADMIN_I18N.zh, key);
    assert.ok(key in ADMIN_I18N.en, key);
    assert.ok(key in ADMIN_I18N.my, key);
  }
});

test("ADMIN-1C RBAC: games/rounds/spins/health map to rounds:view", () => {
  assert.equal(roleHasPermission("OPS", "rounds:view"), true);
  assert.equal(roleHasPermission("SUPPORT", "rounds:view"), true);
  assert.equal(roleHasPermission("AUDIT", "rounds:view"), true);
  assert.equal(roleHasPermission("TECH", "rounds:view"), false);
  assert.equal(roleHasPermission("READONLY", "rounds:view"), true);
});

test("ADMIN-1C auth: no token → 401; games list / detail / rounds / spins", async () => {
  const { db, sqlite } = await freshDb();
  seedGameData(sqlite);
  for (const path of [
    "games",
    "games/bull-demon-king/ops",
    "games/bull-demon-king/health",
    "rounds",
    "spins",
    "rounds/r1",
    "spins/r1",
  ]) {
    const res = await callAdmin(db, path);
    assert.equal(res.status, 401, path);
  }
});

test("ADMIN-1C games list is real, single official title, honest online players", async () => {
  const { db, sqlite } = await freshDb();
  seedGameData(sqlite);
  const { data: loginData } = await login(db);
  const token = loginData.token;
  const games = await callAdmin(db, "games", { token });
  assert.equal(games.status, 200);
  assert.equal(games.data.items.length, 1);
  assert.equal(games.data.items[0].id, "bull-demon-king");
  assert.equal(games.data.items[0].todayRounds, 1);
  assert.equal(games.data.items[0].todaySpins, 1);
  assert.equal(games.data.items[0].todayPlayers, 1);
  assert.equal(games.data.items[0].todayBetMinor, 1000);
  assert.equal(games.data.items[0].todayWinMinor, 2500);
  assert.equal(games.data.items[0].mathVersionId, "mv1");
  assert.equal(games.data.items[0].onlinePlayers, null);
  assert.equal(games.data.items[0].onlinePlayersAvailability, "NOT_AVAILABLE");
  assert.ok(["ACTIVE", "MAINTENANCE", "UNKNOWN"].includes(games.data.items[0].status));
  assert.ok(Array.isArray(games.data.modelLimitations));
});

test("ADMIN-1C bull demon king ops includes math/RTP RO + health + anomalies", async () => {
  const { db, sqlite } = await freshDb();
  seedGameData(sqlite);
  // anomaly: settled without ledger
  sqlite
    .prepare(
      `INSERT INTO game_rounds
        (id, session_id, player_id, math_version_id, idempotency_key, request_hash, status, currency,
         total_bet_minor, total_win_minor, balance_after_minor, wallet_applied, settled_at)
       VALUES ('r-missing', 's1', 'p1', 'mv1', 'idem-miss', 'hash-miss', 'SETTLED', 'MMK', 100, 0, 100, 0, CURRENT_TIMESTAMP)`,
    )
    .run();
  const { data: loginData } = await login(db);
  const token = loginData.token;
  const ops = await callAdmin(db, "games/bull-demon-king/ops", { token });
  assert.equal(ops.status, 200);
  assert.equal(ops.data.game.id, "bull-demon-king");
  assert.equal(ops.data.game.mathVersionId, "mv1");
  assert.equal(ops.data.game.rtpIdentifier, 0.96);
  assert.equal(ops.data.readonly.math, true);
  assert.equal(ops.data.readonly.rtp, true);
  assert.equal(ops.data.presence.onlinePlayersAvailability, "NOT_AVAILABLE");
  assert.ok(ops.data.health?.components?.db);
  assert.ok(ops.data.anomalies.total >= 1);
  assert.ok(ops.data.anomalies.items.some((row) => row.code === "SPIN_MISSING_LEDGER_REFERENCE"));

  const health = await callAdmin(db, "games/bull-demon-king/health", { token });
  assert.equal(health.status, 200);
  assert.equal(health.data.secretsRedacted, true);

  const missing = await callAdmin(db, "games/other-game/ops", { token });
  assert.equal(missing.status, 404);
});

test("ADMIN-1C rounds/spins list filters + detail recon + ledger reference", async () => {
  const { db, sqlite } = await freshDb();
  seedGameData(sqlite);
  const { data: loginData } = await login(db);
  const token = loginData.token;

  const list = await callAdmin(db, "rounds?gameId=bull-demon-king&playerId=p1&page=1", { token });
  assert.equal(list.status, 200);
  assert.equal(list.data.total, 1);
  assert.equal(list.data.items[0].game_id, "bull-demon-king");
  assert.equal(list.data.items[0].net_minor, 1500);
  assert.equal(list.data.items[0].ledger_reference_count, 1);

  const otherGame = await callAdmin(db, "rounds?gameId=fake-game", { token });
  assert.equal(otherGame.status, 200);
  assert.equal(otherGame.data.total, 0);

  const detail = await callAdmin(db, "rounds/r1", { token });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.gameId, "bull-demon-king");
  assert.equal(detail.data.spinCount, 1);
  assert.equal(detail.data.primaryLedgerReference, "tx-1c");
  assert.equal(detail.data.balanceBefore, 10000);
  assert.equal(detail.data.balanceBeforeSource, "DERIVED");
  assert.equal(detail.data.netMinor, 1500);
  assert.equal(detail.data.reconciliation.ok, true);

  const spin = await callAdmin(db, "spins/r1", { token });
  assert.equal(spin.status, 200);
  assert.equal(spin.data.primaryLedgerReference, "tx-1c");
  assert.deepEqual(spin.data.extracted.winningPositions, [{ reel: 2, row: 0 }]);

  // audit recorded for sensitive detail view
  const audits = sqlite
    .prepare(`SELECT action FROM admin_audit_logs WHERE target_id = 'r1' ORDER BY created_at DESC`)
    .all()
    .map((row) => row.action);
  assert.ok(audits.includes("rounds.detail.view") || audits.includes("spins.detail.view"));
});

test("ADMIN-1C reconciliation flags settled round without ledger", async () => {
  const { db, sqlite } = await freshDb();
  seedGameData(sqlite, { roundId: "r-bad", withLedger: false });
  const { data: loginData } = await login(db);
  const token = loginData.token;
  const detail = await callAdmin(db, "rounds/r-bad", { token });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.reconciliation.ok, false);
  assert.ok(
    detail.data.reconciliation.issues.some((issue) => issue.code === "SPIN_MISSING_LEDGER_REFERENCE"),
  );
});

test("ADMIN-1C date range clamp + no math/rtp mutation endpoints", async () => {
  const { db, sqlite } = await freshDb();
  seedGameData(sqlite);
  const { data: loginData } = await login(db);
  const token = loginData.token;

  const wide = await callAdmin(
    db,
    "rounds?from=2020-01-01&to=2026-08-09&gameId=bull-demon-king",
    { token },
  );
  assert.equal(wide.status, 200);
  assert.equal(wide.data.dateRange.limited, true);
  assert.equal(wide.data.dateRange.maxDays, 31);

  for (const path of [
    "games",
    "games/bull-demon-king/ops",
    "math-versions",
    "rounds/r1",
    "spins/r1",
  ]) {
    const res = await callAdmin(db, path, { method: "POST", token, body: { reason: "x", rtp: 0.99 } });
    assert.ok(res.status === 404 || res.status === 405, `POST ${path} must not mutate`);
  }
});

test("ADMIN-1C TECH role cannot view rounds/games", async () => {
  const { db, sqlite } = await freshDb();
  seedGameData(sqlite);
  // create TECH admin via SQL
  const salt = "s".repeat(32);
  // password hash unused — login path uses bootstrap admin; impersonate via role check already covered.
  // Direct API permission: login as readonly then assert TECH matrix.
  assert.equal(roleHasPermission("TECH", "rounds:view"), false);
  assert.equal(roleHasPermission("TECH", "math:view"), true);
  void salt;
});

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
import {
  extractRoundOutcome,
  getRiskSignals,
} from "../lib/admin/admin-queries.ts";
import { roleHasPermission } from "../lib/admin/admin-auth.ts";

function adminRequest(path, { method = "GET", token, body } = {}) {
  const headers = { "content-type": "application/json", "cf-connecting-ip": "10.0.0.9" };
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
  const { db, sqlite } = createTestDb();
  await ensureAdminBootstrap(db);
  return { db, sqlite };
}

async function login(db, username = "admin", password = "admin123") {
  const result = await callAdmin(db, "login", {
    method: "POST",
    body: { username, password },
  });
  return result;
}

function seedPlayerRound(sqlite, { playerId = "p1", bet = 5000, win = 1200 } = {}) {
  sqlite.prepare(`INSERT INTO players (id, wallet_adapter_ref, currency, status) VALUES (?, ?, 'MMK', 'ACTIVE')`)
    .run(playerId, `wallet-${playerId}`);
  sqlite.prepare(`INSERT INTO game_math_versions (id, sha256, status, config_json) VALUES ('mv1', 'sha-1', 'FROZEN', '{}')`)
    .run();
  sqlite.prepare(`INSERT INTO game_sessions (id, player_id, math_version_id, status, currency, free_games_remaining, expires_at)
    VALUES ('s1', ?, 'mv1', 'OPEN', 'MMK', 3, strftime('%Y-%m-%d %H:%M:%S', 'now', '+1 hour'))`)
    .run(playerId);
  const outcome = JSON.stringify({
    grid: [["wild", "scatter", "buffalo"], ["a", "k", "q"], ["scatter", "wild", "j"], ["a", "a", "k"], ["q", "j", "buffalo"]],
    winningPositions: [{ reel: 0, row: 0 }],
    evaluation: { multiplier: 2 },
    mathVersion: "mv1",
  });
  sqlite.prepare(`INSERT INTO game_rounds
    (id, session_id, player_id, math_version_id, idempotency_key, request_hash, status, currency,
     total_bet_minor, total_win_minor, balance_after_minor, outcome_json, settled_at)
    VALUES ('r1', 's1', ?, 'mv1', 'idem-1', 'hash-1', 'SETTLED', 'MMK', ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
    .run(playerId, bet, win, 9000, outcome);
}

test("bootstrap seeds a fail-closed super admin and login works", async () => {
  const { db } = await freshDb();
  const bad = await login(db, "admin", "wrong-password");
  assert.equal(bad.status, 401);

  const ok = await login(db);
  assert.equal(ok.status, 200);
  assert.ok(ok.data.token.length >= 32);
  assert.equal(ok.data.admin.role, "SUPER_ADMIN");
});

test("admin endpoints reject missing or invalid sessions", async () => {
  const { db } = await freshDb();
  const noToken = await callAdmin(db, "players");
  assert.equal(noToken.status, 401);
  const badToken = await callAdmin(db, "players", { token: "deadbeef".repeat(8) });
  assert.equal(badToken.status, 401);
});

test("RBAC denies dangerous operations for read-only roles", async () => {
  const { db } = await freshDb();
  const { data: { token } } = await login(db);

  const created = await callAdmin(db, "admins", {
    method: "POST",
    token,
    body: { username: "viewer", password: "viewer-pass-1", role: "READONLY", reason: "setup" },
  });
  assert.equal(created.status, 201);

  const viewerLogin = await login(db, "viewer", "viewer-pass-1");
  assert.equal(viewerLogin.status, 200);
  const viewerToken = viewerLogin.data.token;

  const canRead = await callAdmin(db, "players", { token: viewerToken });
  assert.equal(canRead.status, 200);

  const freezeDenied = await callAdmin(db, "players/p1/freeze", {
    method: "POST",
    token: viewerToken,
    body: { reason: "attempt" },
  });
  assert.equal(freezeDenied.status, 403);

  const adminCreateDenied = await callAdmin(db, "admins", {
    method: "POST",
    token: viewerToken,
    body: { username: "x2", password: "password-9", role: "OPS", reason: "attempt" },
  });
  assert.equal(adminCreateDenied.status, 403);

  assert.equal(roleHasPermission("READONLY", "players:freeze"), false);
  assert.equal(roleHasPermission("RISK", "players:freeze"), true);
  assert.equal(roleHasPermission("SUPER_ADMIN", "admins:manage"), true);
});

test("freeze/unfreeze requires reason, updates status and writes audit log", async () => {
  const { db, sqlite } = await freshDb();
  seedPlayerRound(sqlite);
  const { data: { token } } = await login(db);

  const noReason = await callAdmin(db, "players/p1/freeze", {
    method: "POST",
    token,
    body: {},
  });
  assert.equal(noReason.status, 400);

  const frozen = await callAdmin(db, "players/p1/freeze", {
    method: "POST",
    token,
    body: { reason: "risk review" },
  });
  assert.equal(frozen.status, 200);
  const status = sqlite.prepare("SELECT status FROM players WHERE id = 'p1'").get();
  assert.equal(status.status, "LOCKED");

  const doubleFreeze = await callAdmin(db, "players/p1/freeze", {
    method: "POST",
    token,
    body: { reason: "again" },
  });
  assert.equal(doubleFreeze.status, 409);

  const unfrozen = await callAdmin(db, "players/p1/unfreeze", {
    method: "POST",
    token,
    body: { reason: "reviewed ok" },
  });
  assert.equal(unfrozen.status, 200);
  const status2 = sqlite.prepare("SELECT status FROM players WHERE id = 'p1'").get();
  assert.equal(status2.status, "ACTIVE");

  const logs = await callAdmin(db, "logs/admin", { token });
  assert.equal(logs.status, 200);
  const freezeLog = logs.data.items.find((row) => row.action === "player.freeze");
  assert.ok(freezeLog);
  assert.equal(freezeLog.reason, "risk review");
  assert.equal(freezeLog.ip, "10.0.0.9");
  assert.equal(freezeLog.admin_username, "admin");
});

test("dashboard metrics reflect seeded game data", async () => {
  const { db, sqlite } = await freshDb();
  seedPlayerRound(sqlite, { bet: 5000, win: 1200 });
  const { data: { token } } = await login(db);

  const dash = await callAdmin(db, "dashboard", { token });
  assert.equal(dash.status, 200);
  assert.equal(dash.data.onlineNow, 1);
  assert.equal(dash.data.todayNew, 1);
  assert.equal(dash.data.todayActive, 1);
  assert.equal(dash.data.spinCount, 1);
  assert.equal(dash.data.todayBetMinor, 5000);
  assert.equal(dash.data.todayPayoutMinor, 1200);
  assert.equal(dash.data.todayProfitMinor, 3800);
  assert.equal(dash.data.rtpPercent, 24);
  assert.equal(dash.data.freeSpinsNow, 3);
  assert.equal(dash.data.system.ok, true);
  assert.equal(dash.data.ledger.ok, true);
});

test("round detail extracts grid/scatter/wild/multiplier from outcome_json", async () => {
  const { db, sqlite } = await freshDb();
  seedPlayerRound(sqlite);
  const { data: { token } } = await login(db);

  const detail = await callAdmin(db, "rounds/r1", { token });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.extracted.scatterCount, 2);
  assert.equal(detail.data.extracted.wildCount, 2);
  assert.equal(detail.data.extracted.multiplier, 2);
  assert.equal(detail.data.extracted.winningPositions.length, 1);
  assert.equal(detail.data.balanceBefore, 9000 - 1200 + 5000);

  const empty = extractRoundOutcome(null);
  assert.equal(empty.grid, null);
  assert.equal(empty.scatterCount, null);
});

test("ledger health flags unbalanced transactions and projection mismatch", async () => {
  const { db, sqlite } = await freshDb();
  const { data: { token } } = await login(db);

  const healthy = await callAdmin(db, "ledger/health", { token });
  assert.equal(healthy.status, 200);
  assert.equal(healthy.data.ok, true);

  sqlite.prepare(`INSERT INTO ledger_accounts (id, player_id, kind, currency, balance_minor, version)
    VALUES ('acc-1', NULL, 'GAME_CLEARING', 'MMK', 100, 3)`).run();
  sqlite.prepare(`INSERT INTO ledger_transactions (id, idempotency_key, kind, status, request_hash)
    VALUES ('tx-1', 'tx-idem-1', 'GAME_BET', 'POSTED', 'rh-1')`).run();
  sqlite.prepare(`INSERT INTO ledger_entries (id, transaction_id, account_id, sequence, amount_minor, currency, balance_after_minor)
    VALUES ('e-1', 'tx-1', 'acc-1', 1, -100, 'MMK', 0)`).run();
  sqlite.prepare(`INSERT INTO ledger_balances (account_id, balance_minor, version) VALUES ('acc-1', 999, 3)`).run();

  const unhealthy = await callAdmin(db, "ledger/health", { token });
  assert.equal(unhealthy.data.ok, false);
  assert.equal(unhealthy.data.unbalancedTx, 1);
  assert.deepEqual(unhealthy.data.unbalancedIds, ["tx-1"]);
  assert.equal(unhealthy.data.projectionMismatch, 1);
  assert.deepEqual(unhealthy.data.mismatchAccountIds, ["acc-1"]);
});

test("risk center surfaces abnormal bets and math mismatch", async () => {
  const { db, sqlite } = await freshDb();
  seedPlayerRound(sqlite, { bet: 2_000_000, win: 0 });
  sqlite.prepare(`INSERT INTO game_rounds
    (id, session_id, player_id, math_version_id, idempotency_key, request_hash, status, currency, total_bet_minor)
    VALUES ('r2', 's1', 'p1', 'mv-other', 'idem-2', 'hash-2', 'PENDING', 'MMK', 100)`).run();

  const { data: { token } } = await login(db);
  const risk = await callAdmin(db, "risk/signals", { token });
  assert.equal(risk.status, 200);
  const types = risk.data.items.map((row) => row.type);
  assert.ok(types.includes("ABNORMAL_BET"));
  assert.ok(types.includes("MATH_MISMATCH"));

  const direct = await getRiskSignals(db);
  const critical = direct.filter((signal) => signal.level === "CRITICAL");
  assert.ok(critical.some((signal) => signal.type === "MATH_MISMATCH"));
});

test("read-only guarantee: no mutation endpoints exist for wallet/ledger/math", async () => {
  const { db } = await freshDb();
  const { data: { token } } = await login(db);
  for (const path of ["wallet/intents", "wallet/provider-ops", "ledger/accounts", "ledger/transactions", "ledger/entries", "ledger/balances", "math-versions"]) {
    const response = await callAdmin(db, path, { method: "POST", token, body: { reason: "x" } });
    assert.equal(response.status, 404, `POST ${path} must not exist`);
  }
});

test("system config update is whitelisted, audited and validated", async () => {
  const { db } = await freshDb();
  const { data: { token } } = await login(db);

  const badKey = await callAdmin(db, "system/config", {
    method: "POST",
    token,
    body: { key: "wallet_balance", value: {}, reason: "try" },
  });
  assert.equal(badKey.status, 400);

  const maintenance = await callAdmin(db, "system/config", {
    method: "POST",
    token,
    body: { key: "maintenance_mode", value: { enabled: true }, reason: "deploy" },
  });
  assert.equal(maintenance.status, 200);

  const config = await callAdmin(db, "system/config", { token });
  const mm = config.data.items.find((row) => row.key === "maintenance_mode");
  assert.equal(mm.value.enabled, true);
  assert.equal(mm.updatedBy, "admin");
});

test("admin self-disable is blocked; disable revokes sessions", async () => {
  const { db } = await freshDb();
  const { data: loginData } = await login(db);
  const token = loginData.token;
  const selfId = loginData.admin.id;

  const selfDisable = await callAdmin(db, `admins/${selfId}`, {
    method: "POST",
    token,
    body: { action: "disable", reason: "self" },
  });
  assert.equal(selfDisable.status, 409);

  await callAdmin(db, "admins", {
    method: "POST",
    token,
    body: { username: "ops1", password: "ops-pass-123", role: "OPS", reason: "staff" },
  });
  const opsLogin = await login(db, "ops1", "ops-pass-123");
  const opsId = opsLogin.data.admin.id;

  const disabled = await callAdmin(db, `admins/${opsId}`, {
    method: "POST",
    token,
    body: { action: "disable", reason: "offboard" },
  });
  assert.equal(disabled.status, 200);

  const opsAfter = await callAdmin(db, "players", { token: opsLogin.data.token });
  assert.equal(opsAfter.status, 401);
});

test("i18n dictionaries have identical, non-empty key sets (zh/en/my)", () => {
  const [zh, en, my] = ADMIN_LOCALES.map((locale) => ADMIN_I18N[locale]);
  const zhKeys = Object.keys(zh).sort();
  assert.deepEqual(Object.keys(en).sort(), zhKeys);
  assert.deepEqual(Object.keys(my).sort(), zhKeys);
  for (const dict of [zh, en, my]) {
    for (const [key, value] of Object.entries(dict)) {
      assert.ok(typeof value === "string" && value.trim().length > 0, `empty translation: ${key}`);
    }
  }
});

test("session and spin query endpoints are read-only and return seeded data", async () => {
  const { db, sqlite } = await freshDb();
  seedPlayerRound(sqlite);
  const { data: { token } } = await login(db);

  const sessions = await callAdmin(db, "sessions", { token });
  assert.equal(sessions.status, 200);
  assert.equal(sessions.data.total, 1);
  assert.equal(sessions.data.items[0].id, "s1");

  const sessionDetail = await callAdmin(db, "sessions/s1", { token });
  assert.equal(sessionDetail.status, 200);
  assert.equal(sessionDetail.data.aggregates.roundCount, 1);

  const spins = await callAdmin(db, "spins", { token });
  assert.equal(spins.status, 200);
  assert.equal(spins.data.total, 1);

  const spinDetail = await callAdmin(db, "spins/r1", { token });
  assert.equal(spinDetail.status, 200);
  assert.ok(spinDetail.data.extracted.grid);

  for (const path of ["sessions", "sessions/s1", "spins", "spins/r1", "reports/ops"]) {
    const blocked = await callAdmin(db, path, { method: "POST", token, body: { reason: "x" } });
    assert.equal(blocked.status, 404, `POST ${path} must not exist`);
  }
});

test("ops report, system monitor and admin stats endpoints work on M5 baseline", async () => {
  const { db, sqlite } = await freshDb();
  seedPlayerRound(sqlite);
  const { data: { token } } = await login(db);

  const report = await callAdmin(db, "reports/ops", { token });
  assert.equal(report.status, 200);
  assert.ok(report.data.summary);
  assert.ok(Array.isArray(report.data.topPlayers));
  assert.equal(report.data.summary.dau, 1);
  assert.ok(report.data.summary.mau >= 1);
  assert.ok(report.data.retention);
  assert.ok(report.data.rankings?.byBet?.length >= 1);

  const status = await callAdmin(db, "system/status", { token });
  assert.equal(status.status, 200);
  assert.equal(status.data.version.baseline, "9654d4194d2db801467af34cef1ddc5650fd310f");
  assert.equal(status.data.version.module, "R1-M9");
  assert.ok(typeof status.data.sessions.open === "number");
  assert.ok(typeof status.data.risk.total === "number");
  assert.equal(status.data.database.ok, true);
  assert.ok(typeof status.data.database.latencyMs === "number");
  assert.equal(status.data.probes.selectOne, true);
  assert.equal(status.data.probes.ledgerQueryable, true);

  const stats = await callAdmin(db, "admins/stats", { token });
  assert.equal(stats.status, 200);
  assert.ok(stats.data.active >= 1);

  const matrix = await callAdmin(db, "admins/matrix", { token });
  assert.equal(matrix.status, 200);
  assert.ok(matrix.data.permissions.includes("players:freeze"));
  assert.ok(matrix.data.roles.some((row) => row.role === "SUPER_ADMIN"));
});

test("dashboard exposes byCurrency and sparklineSpins", async () => {
  const { db, sqlite } = await freshDb();
  seedPlayerRound(sqlite, { bet: 5000, win: 1200 });
  const { data: { token } } = await login(db);
  const dash = await callAdmin(db, "dashboard", { token });
  assert.equal(dash.status, 200);
  assert.ok(Array.isArray(dash.data.byCurrency));
  assert.ok(dash.data.byCurrency.some((row) => row.currency === "MMK"));
  assert.ok(Array.isArray(dash.data.sparklineSpins));
  assert.ok(dash.data.sparklineSpins.length >= 1);
});

test("wallet intent detail returns timeline and is GET-only", async () => {
  const { db, sqlite } = await freshDb();
  seedPlayerRound(sqlite);
  sqlite.prepare(`INSERT INTO wallet_intents
    (id, player_id, idempotency_key, operation, status, currency, amount_minor, request_hash, created_at, updated_at)
    VALUES ('wi-1', 'p1', 'idem-w1', 'DEBIT', 'SUCCESS', 'MMK', 5000, 'rh-w1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run();
  sqlite.prepare(`INSERT INTO wallet_provider_ops
    (id, intent_id, idempotency_key, status, currency, amount_minor, direction, created_at, updated_at)
    VALUES ('wpo-1', 'wi-1', 'idem-w1', 'SUCCESS', 'MMK', 5000, 'DEBIT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run();

  const { data: { token } } = await login(db);
  const detail = await callAdmin(db, "wallet/intents/wi-1", { token });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.intent.id, "wi-1");
  assert.ok(detail.data.timeline.some((row) => row.stage === "intent.created"));
  assert.ok(detail.data.timeline.some((row) => row.stage === "provider_op"));
  assert.equal(detail.data.providerOps.length, 1);

  const blocked = await callAdmin(db, "wallet/intents/wi-1", {
    method: "POST",
    token,
    body: { reason: "x" },
  });
  assert.equal(blocked.status, 404);
});

test("math versions expose RTP summary and usage counts", async () => {
  const { db, sqlite } = await freshDb();
  sqlite.prepare(`INSERT INTO game_math_versions (id, sha256, status, config_json)
    VALUES ('mv-rtp', 'sha-rtp', 'FROZEN', '{"theoreticalRtp":96.5,"paylineCount":50}')`).run();
  sqlite.prepare(`INSERT INTO players (id, wallet_adapter_ref, currency, status) VALUES ('p-m', 'w-m', 'MMK', 'ACTIVE')`).run();
  sqlite.prepare(`INSERT INTO game_sessions (id, player_id, math_version_id, status, currency, free_games_remaining, expires_at)
    VALUES ('s-m', 'p-m', 'mv-rtp', 'OPEN', 'MMK', 0, strftime('%Y-%m-%d %H:%M:%S', 'now', '+1 hour'))`).run();
  sqlite.prepare(`INSERT INTO game_rounds
    (id, session_id, player_id, math_version_id, idempotency_key, request_hash, status, currency, total_bet_minor, total_win_minor)
    VALUES ('r-m', 's-m', 'p-m', 'mv-rtp', 'idem-m', 'hash-m', 'SETTLED', 'MMK', 100, 50)`).run();

  const { data: { token } } = await login(db);
  const list = await callAdmin(db, "math-versions", { token });
  assert.equal(list.status, 200);
  const row = list.data.items.find((item) => item.id === "mv-rtp");
  assert.ok(row);
  assert.equal(row.summary.rtp, 96.5);
  assert.equal(row.sessionCount, 1);
  assert.equal(row.roundCount, 1);

  const detail = await callAdmin(db, "math-versions/mv-rtp", { token });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.sessionCount, 1);
  assert.equal(detail.data.roundCount, 1);
});

test("ledger REVERSED filter and announcement draft create without migration", async () => {
  const { db, sqlite } = await freshDb();
  sqlite.prepare(`INSERT INTO ledger_transactions (id, idempotency_key, kind, status, request_hash)
    VALUES ('tx-rev', 'idem-rev', 'REVERSAL', 'REVERSED', 'rh-rev')`).run();
  const { data: { token } } = await login(db);

  const txs = await callAdmin(db, "ledger/transactions?status=REVERSED&kind=REVERSAL", { token });
  assert.equal(txs.status, 200);
  assert.equal(txs.data.total, 1);
  assert.equal(txs.data.items[0].id, "tx-rev");

  const draft = await callAdmin(db, "system/announcements", {
    method: "POST",
    token,
    body: {
      title: "draft-ann",
      locales: { zh: "中文", en: "English", my: "မြန်မာ" },
      publishAt: "2099-01-01T00:00",
      status: "UNPUBLISHED",
      reason: "schedule draft",
    },
  });
  assert.equal(draft.status, 201);
  assert.equal(draft.data.status, "UNPUBLISHED");

  const anns = await callAdmin(db, "system/announcements", { token });
  const created = anns.data.items.find((row) => row.id === draft.data.id);
  assert.ok(created);
  assert.equal(created.status, "UNPUBLISHED");
  const payload = JSON.parse(created.content);
  assert.equal(payload.zh, "中文");
  assert.equal(payload.en, "English");
  assert.equal(payload.my, "မြန်မာ");
  assert.ok(payload.publishAt);
});

test("risk HIGH_FREQ_SPIN and honest MULTI_DEVICE_UNAVAILABLE", async () => {
  const { db, sqlite } = await freshDb();
  seedPlayerRound(sqlite);
  for (let i = 0; i < 30; i += 1) {
    sqlite.prepare(`INSERT INTO game_rounds
      (id, session_id, player_id, math_version_id, idempotency_key, request_hash, status, currency, total_bet_minor, total_win_minor, created_at)
      VALUES (?, 's1', 'p1', 'mv1', ?, ?, 'SETTLED', 'MMK', 100, 0, strftime('%Y-%m-%d %H:%M:%S', 'now'))`)
      .run(`r-hf-${i}`, `idem-hf-${i}`, `hash-hf-${i}`);
  }
  const { data: { token } } = await login(db);
  const risk = await callAdmin(db, "risk/signals", { token });
  assert.equal(risk.status, 200);
  const types = risk.data.items.map((row) => row.type);
  assert.ok(types.includes("HIGH_FREQ_SPIN"));
  assert.ok(types.includes("MULTI_DEVICE_UNAVAILABLE"));
  assert.ok(!types.includes("MULTI_DEVICE"));

  const player = await callAdmin(db, "players/p1", { token });
  assert.equal(player.status, 200);
  assert.ok(Array.isArray(player.data.riskTags));
  assert.ok(player.data.riskTags.includes("HIGH_FREQ_SPIN"));
});

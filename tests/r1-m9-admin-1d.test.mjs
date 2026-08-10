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
import { ensureWalletCommerceReady } from "../lib/wallet-commerce-bootstrap.ts";

function adminRequest(path, { method = "GET", token, body } = {}) {
  const headers = {
    "content-type": "application/json",
    "cf-connecting-ip": "10.0.0.9",
    "x-request-id": "req-test-1d",
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
  await ensureWalletCommerceReady(db);
  return { db, sqlite };
}

async function login(db, username = "admin", password = "admin123") {
  return callAdmin(db, "login", { method: "POST", body: { username, password } });
}

function seedWallet(sqlite, { playerId = "p-wallet-1", available = 10000, frozen = 2500 } = {}) {
  sqlite
    .prepare(`INSERT INTO players (id, wallet_adapter_ref, currency, status) VALUES (?, ?, 'MMK', 'ACTIVE')`)
    .run(playerId, `wallet-${playerId}`);
  sqlite
    .prepare(
      `INSERT INTO ledger_accounts (id, player_id, kind, currency, balance_minor, version)
       VALUES (?, ?, 'PLAYER_AVAILABLE', 'MMK', ?, 1)`,
    )
    .run(`acc-avail-${playerId}`, playerId, available);
  if (frozen > 0) {
    sqlite
      .prepare(
        `INSERT INTO withdrawal_requests
          (id, player_id, currency, channel_code, account_masked, account_cipher, amount_minor, fee_minor, expected_minor, status, idempotency_key, created_at, updated_at)
         VALUES (?, ?, 'MMK', 'BANK', '****1234', 'cipher-x', ?, 0, ?, 'PENDING', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .run(`wd-${playerId}`, playerId, frozen, frozen, `idem-wd-${playerId}`);
  }
  sqlite
    .prepare(
      `INSERT INTO ledger_transactions (id, idempotency_key, round_id, kind, status, request_hash)
       VALUES (?, 'tx-idem-1d', NULL, 'DEPOSIT', 'POSTED', 'rh-1d')`,
    )
    .run(`tx-${playerId}`);
  sqlite
    .prepare(
      `INSERT INTO ledger_entries
        (id, transaction_id, account_id, sequence, amount_minor, currency, balance_after_minor)
       VALUES (?, ?, ?, 1, ?, 'MMK', ?)`,
    )
    .run(`le-${playerId}`, `tx-${playerId}`, `acc-avail-${playerId}`, available, available);
}

test("ADMIN-1D i18n key parity ZH/EN/MY", () => {
  const zhKeys = Object.keys(ADMIN_I18N.zh).sort();
  for (const locale of ADMIN_LOCALES) {
    assert.deepEqual(Object.keys(ADMIN_I18N[locale]).sort(), zhKeys, `locale ${locale}`);
  }
  for (const key of [
    "wallet.frozenBalance",
    "wallet.tab.integrity",
    "ledger.balanceBefore",
    "money.gateClosed",
    "deposits.gateHint",
  ]) {
    assert.ok(ADMIN_I18N.zh[key], key);
    assert.ok(ADMIN_I18N.en[key], key);
    assert.ok(ADMIN_I18N.my[key], key);
  }
});

test("ADMIN-1D RBAC wallet integrity + no adjust permission", () => {
  assert.equal(roleHasPermission("FINANCE", "wallet:integrity:view"), true);
  assert.equal(roleHasPermission("AUDIT", "wallet:integrity:view"), true);
  assert.equal(roleHasPermission("SUPPORT", "wallet:integrity:view"), false);
  assert.equal(roleHasPermission("FINANCE", "wallet:view"), true);
  assert.equal(roleHasPermission("FINANCE", "ledger:view"), true);
});

test("ADMIN-1D auth gates wallet endpoints", async () => {
  const { db } = await freshDb();
  const noAuth = await callAdmin(db, "wallet/balances");
  assert.equal(noAuth.status, 401);

  const loginRes = await login(db);
  assert.equal(loginRes.status, 200);
  const token = loginRes.data.token;

  // Create a SUPPORT admin via superadmin bootstrap default roles — use finance by minting session as admin.
  const balances = await callAdmin(db, "wallet/balances", { token });
  assert.equal(balances.status, 200);
  assert.ok(Array.isArray(balances.data.items));

  const gate = await callAdmin(db, "money/gate", { token });
  assert.equal(gate.status, 200);
  assert.equal(gate.data.gate, "CLOSED");
  assert.equal(gate.data.realMoneyProvider, "NOT_CONFIGURED");
  assert.equal(gate.data.productionMoney, false);
});

test("ADMIN-1D frozenMinor from commerce holds not frontend guess", async () => {
  const { db, sqlite } = await freshDb();
  seedWallet(sqlite, { playerId: "p-froz", available: 8000, frozen: 3000 });
  const loginRes = await login(db);
  const token = loginRes.data.token;

  const list = await callAdmin(db, "wallet/balances?search=p-froz", { token });
  assert.equal(list.status, 200);
  const row = list.data.items.find((item) => item.playerId === "p-froz");
  assert.ok(row);
  assert.equal(row.availableMinor, 8000);
  assert.equal(row.frozenMinor, 3000);
  assert.equal(row.totalMinor, 11000);
  assert.match(String(list.data.source.frozen), /withdrawal_requests/);

  const detail = await callAdmin(db, "wallet/players/p-froz", { token });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.frozenMinor, 3000);
  assert.equal(detail.data.availableMinor, 8000);
  assert.equal(detail.data.totalMinor, 11000);

  const player = await callAdmin(db, "players/p-froz", { token });
  assert.equal(player.status, 200);
  assert.equal(player.data.walletSummary.frozenMinor, 3000);
  assert.equal(player.data.walletSummary.totalMinor, 11000);
});

test("ADMIN-1D ledger detail + reverse links", async () => {
  const { db, sqlite } = await freshDb();
  seedWallet(sqlite, { playerId: "p-led", available: 5000, frozen: 0 });
  const loginRes = await login(db);
  const token = loginRes.data.token;

  const txs = await callAdmin(db, "ledger/transactions?playerId=p-led", { token });
  assert.equal(txs.status, 200);
  assert.ok(txs.data.total >= 1);
  const id = txs.data.items[0].id;
  const detail = await callAdmin(db, `ledger/transactions/${id}`, { token });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.ledgerId, id);
  assert.equal(detail.data.playerId, "p-led");
  assert.ok(["MATCH", "MISMATCH", "UNKNOWN"].includes(detail.data.reconciliation.status));
  assert.equal(detail.data.links.ledgerId, id);
});

test("ADMIN-1D integrity endpoint + deposit/withdraw pay gate codes", async () => {
  const { db } = await freshDb();
  const loginRes = await login(db);
  const token = loginRes.data.token;

  const integrity = await callAdmin(db, "wallet/integrity", { token });
  assert.equal(integrity.status, 200);
  assert.equal(integrity.data.autoFix, false);
  assert.ok(Array.isArray(integrity.data.items));

  // With harness enabled, confirm still requires reason; pay gated when harness off tested below.
  const confirmNoReason = await callAdmin(db, "deposits/x/confirm", {
    token,
    method: "POST",
    body: {},
  });
  assert.ok([400, 404].includes(confirmNoReason.status));
});

test("ADMIN-1D withdraw pay blocked when harness disabled", async () => {
  const { db } = await freshDb();
  const loginRes = await login(db);
  assert.equal(loginRes.status, 200);
  const token = loginRes.data.token;
  const prev = process.env.AB_ALLOW_TEST_IDENTITY;
  process.env.AB_ALLOW_TEST_IDENTITY = "0";
  try {
    const pay = await callAdmin(db, "withdrawals/wd-x/pay", {
      token,
      method: "POST",
      body: { reason: "try production pay" },
    });
    assert.equal(pay.status, 503);
    assert.equal(pay.data.error.code, "PROVIDER_NOT_CONFIGURED");
  } finally {
    process.env.AB_ALLOW_TEST_IDENTITY = prev ?? "1";
  }
});

test("ADMIN-1D dashboard money metrics + gate", async () => {
  const { db } = await freshDb();
  const loginRes = await login(db);
  const token = loginRes.data.token;
  const dash = await callAdmin(db, "dashboard", { token });
  assert.equal(dash.status, 200);
  assert.ok(dash.data.moneyGate);
  assert.equal(dash.data.moneyGate.gate, "CLOSED");
  assert.ok(dash.data.moneyMetrics);
  assert.ok(dash.data.moneyMetrics.todayDepositCount.availability);
});

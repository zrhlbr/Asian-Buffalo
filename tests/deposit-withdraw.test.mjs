import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { createTestDb } from "./db-helper.mjs";
import { ensurePlayerCommerceSchema } from "../lib/player-commerce-bootstrap.ts";
import { ensureWalletCommerceSchema } from "../lib/wallet-commerce-bootstrap.ts";
import {
  confirmDepositOrder,
  createDepositOrder,
} from "../lib/deposit-service.ts";
import {
  createWithdrawalRequest,
  reviewWithdrawal,
  markWithdrawalPaid,
  sumFrozenWithdrawals,
} from "../lib/withdrawal-service.ts";
import { MoneyService } from "../lib/money-service.ts";

async function seedPlayer(db, id = "cash-player") {
  await db.run(sql`
    INSERT INTO players ("id", "wallet_adapter_ref", "currency", "status")
    VALUES (${id}, ${`w_${id}`}, 'MMK', 'ACTIVE')
  `);
}

test("deposit create → confirm credits once (idempotent)", async () => {
  const { db } = createTestDb();
  await ensurePlayerCommerceSchema(db);
  await ensureWalletCommerceSchema(db);
  await seedPlayer(db);
  const money = new MoneyService({ mode: "TEST" });
  await money.seed("cash-player", "MMK", 1000);

  const created = await createDepositOrder(db, {
    playerId: "cash-player",
    currency: "MMK",
    channelCode: "KBZ",
    amountMinor: 1000,
    idempotencyKey: "dep-idem-1",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const again = await createDepositOrder(db, {
    playerId: "cash-player",
    currency: "MMK",
    channelCode: "KBZ",
    amountMinor: 1000,
    idempotencyKey: "dep-idem-1",
  });
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.alreadyExists, true);

  const first = await confirmDepositOrder(db, {
    orderId: created.order.id,
    playerId: "cash-player",
    moneyService: money,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.balanceAfterMinor, 2000);

  const second = await confirmDepositOrder(db, {
    orderId: created.order.id,
    playerId: "cash-player",
    moneyService: money,
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.alreadyCredited, true);
  assert.equal(second.balanceAfterMinor, 2000);
});

test("deposit rejects non-preset amount and cross-player confirm", async () => {
  const { db } = createTestDb();
  await ensurePlayerCommerceSchema(db);
  await ensureWalletCommerceSchema(db);
  await seedPlayer(db, "p1");
  await seedPlayer(db, "p2");

  const bad = await createDepositOrder(db, {
    playerId: "p1",
    currency: "MMK",
    channelCode: "KBZ",
    amountMinor: 1234,
    idempotencyKey: "dep-bad",
  });
  assert.equal(bad.ok, false);

  const created = await createDepositOrder(db, {
    playerId: "p1",
    currency: "MMK",
    channelCode: "KBZ",
    amountMinor: 5000,
    idempotencyKey: "dep-ok",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const cross = await confirmDepositOrder(db, {
    orderId: created.order.id,
    playerId: "p2",
  });
  assert.equal(cross.ok, false);
  if (cross.ok) return;
  assert.equal(cross.code, "FORBIDDEN");
});

test("withdrawal hold → reject releases; approve → pay keeps debit", async () => {
  const { db } = createTestDb();
  await ensurePlayerCommerceSchema(db);
  await ensureWalletCommerceSchema(db);
  await seedPlayer(db, "wd-player");
  const money = new MoneyService({ mode: "TEST" });
  await money.seed("wd-player", "MMK", 50_000);

  const created = await createWithdrawalRequest(db, {
    playerId: "wd-player",
    currency: "MMK",
    channelCode: "WAVE",
    account: "09123456789",
    amountMinor: 5000,
    idempotencyKey: "wd-1",
    moneyService: money,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(await money.getAvailableBalance("wd-player", "MMK"), 45_000);
  assert.equal(await sumFrozenWithdrawals(db, "wd-player", "MMK"), 5000);

  const rejected = await reviewWithdrawal(db, {
    id: created.request.id,
    action: "REJECT",
    adminId: "admin-1",
    reason: "test reject",
    moneyService: money,
  });
  assert.equal(rejected.ok, true);
  assert.equal(await money.getAvailableBalance("wd-player", "MMK"), 50_000);
  assert.equal(await sumFrozenWithdrawals(db, "wd-player", "MMK"), 0);

  const created2 = await createWithdrawalRequest(db, {
    playerId: "wd-player",
    currency: "MMK",
    channelCode: "WAVE",
    account: "09123456789",
    amountMinor: 5000,
    idempotencyKey: "wd-2",
    moneyService: money,
  });
  assert.equal(created2.ok, true);
  if (!created2.ok) return;

  const approved = await reviewWithdrawal(db, {
    id: created2.request.id,
    action: "APPROVE",
    adminId: "admin-1",
    reason: "ok",
    moneyService: money,
  });
  assert.equal(approved.ok, true);

  const paid = await markWithdrawalPaid(db, {
    id: created2.request.id,
    adminId: "admin-1",
    reason: "paid harness",
  });
  assert.equal(paid.ok, true);
  if (!paid.ok) return;
  assert.equal(paid.request.status, "PAID");
  assert.equal(await money.getAvailableBalance("wd-player", "MMK"), 45_000);
});

test("withdrawal anti-overdraw", async () => {
  const { db } = createTestDb();
  await ensurePlayerCommerceSchema(db);
  await ensureWalletCommerceSchema(db);
  await seedPlayer(db, "poor");
  const money = new MoneyService({ mode: "TEST" });
  await money.seed("poor", "MMK", 1000);

  const result = await createWithdrawalRequest(db, {
    playerId: "poor",
    currency: "MMK",
    channelCode: "KBZ",
    account: "09999999999",
    amountMinor: 5000,
    idempotencyKey: "wd-poor",
    moneyService: money,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "INSUFFICIENT_BALANCE");
});

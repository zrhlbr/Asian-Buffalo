import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { createTestDb } from "./db-helper.mjs";
import { ensurePlayerCommerceSchema } from "../lib/player-commerce-bootstrap.ts";
import { ensureWalletCommerceSchema } from "../lib/wallet-commerce-bootstrap.ts";
import { getWalletSnapshot } from "../lib/wallet-commerce-service.ts";
import { createDepositOrder, confirmDepositOrder } from "../lib/deposit-service.ts";
import { createWithdrawalRequest } from "../lib/withdrawal-service.ts";
import { listPlayerWins } from "../lib/win-history.ts";
import { MoneyService } from "../lib/money-service.ts";
import { ROLE_PERMISSIONS, roleHasPermission } from "../lib/admin/admin-auth.ts";

test("wallet snapshot available/frozen/recent moves", async () => {
  const { db } = createTestDb();
  await ensurePlayerCommerceSchema(db);
  await ensureWalletCommerceSchema(db);
  await db.run(sql`
    INSERT INTO players ("id", "wallet_adapter_ref", "currency", "status")
    VALUES ('snap-player', 'w_snap', 'MMK', 'ACTIVE')
  `);
  const money = new MoneyService({ mode: "TEST" });
  await money.seed("snap-player", "MMK", 20_000);

  const dep = await createDepositOrder(db, {
    playerId: "snap-player",
    currency: "MMK",
    channelCode: "KBZ",
    amountMinor: 1000,
    idempotencyKey: "snap-dep",
  });
  assert.equal(dep.ok, true);
  if (!dep.ok) return;
  await confirmDepositOrder(db, {
    orderId: dep.order.id,
    playerId: "snap-player",
    moneyService: money,
  });

  const wd = await createWithdrawalRequest(db, {
    playerId: "snap-player",
    currency: "MMK",
    channelCode: "KBZ",
    account: "09111111111",
    amountMinor: 5000,
    idempotencyKey: "snap-wd",
    moneyService: money,
  });
  assert.equal(wd.ok, true);

  const snap = await getWalletSnapshot(db, "snap-player", "MMK", money);
  assert.equal(snap.availableMinor, 16_000);
  assert.equal(snap.frozenMinor, 5000);
  assert.equal(snap.status, "FROZEN_HOLDS");
  assert.ok(snap.recentMoves.some((m) => m.kind === "DEPOSIT"));
  assert.ok(snap.recentMoves.some((m) => m.kind === "WITHDRAWAL"));
});

test("win history RO empty for new player", async () => {
  const { db } = createTestDb();
  await db.run(sql`
    INSERT INTO players ("id", "wallet_adapter_ref", "currency", "status")
    VALUES ('win-player', 'w_win', 'MMK', 'ACTIVE')
  `);
  const result = await listPlayerWins(db, "win-player");
  assert.equal(result.total, 0);
  assert.deepEqual(result.items, []);
});

test("RBAC finance can review withdraw; support cannot pay", () => {
  assert.equal(roleHasPermission("FINANCE", "withdraw:review"), true);
  assert.equal(roleHasPermission("FINANCE", "withdraw:pay"), true);
  assert.equal(roleHasPermission("SUPPORT", "withdraw:view"), true);
  assert.equal(roleHasPermission("SUPPORT", "withdraw:pay"), false);
  assert.equal(roleHasPermission("OPS", "deposit:manage"), true);
  assert.equal(roleHasPermission("READONLY", "deposit:manage"), false);
  assert.ok(ROLE_PERMISSIONS.SUPER_ADMIN === "*");
});

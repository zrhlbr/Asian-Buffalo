import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { createTestDb } from "./db-helper.mjs";
import { ensurePlayerCommerceSchema } from "../lib/player-commerce-bootstrap.ts";
import { ensureWalletCommerceSchema } from "../lib/wallet-commerce-bootstrap.ts";
import {
  claimActivity,
  claimCheckin,
  getCheckinStatus,
  listActivities,
} from "../lib/activity-service.ts";
import { MoneyService } from "../lib/money-service.ts";

test("expired activity not joinable; welcome claim credits once", async () => {
  const { db } = createTestDb();
  await ensurePlayerCommerceSchema(db);
  await ensureWalletCommerceSchema(db);
  await db.run(sql`
    INSERT INTO players ("id", "wallet_adapter_ref", "currency", "status")
    VALUES ('act-player', 'w_act', 'MMK', 'ACTIVE')
  `);
  const money = new MoneyService({ mode: "TEST" });
  await money.seed("act-player", "MMK", 500);

  const list = await listActivities(db, "act-player");
  const expired = list.find((a) => a.code === "EXPIRED_DEMO");
  const welcome = list.find((a) => a.code === "WELCOME");
  assert.ok(expired);
  assert.equal(expired.joinable, false);
  assert.equal(expired.lockedReason, "EXPIRED");
  assert.ok(welcome);
  assert.equal(welcome.joinable, true);

  const expiredClaim = await claimActivity(db, "act-player", expired.id, money);
  assert.equal(expiredClaim.ok, false);

  const first = await claimActivity(db, "act-player", welcome.id, money);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.balanceAfterMinor, 600);

  const second = await claimActivity(db, "act-player", welcome.id, money);
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.alreadyClaimed, true);
  assert.equal(second.balanceAfterMinor, 600);
});

test("check-in daily idempotency", async () => {
  const { db } = createTestDb();
  await ensurePlayerCommerceSchema(db);
  await ensureWalletCommerceSchema(db);
  await db.run(sql`
    INSERT INTO players ("id", "wallet_adapter_ref", "currency", "status")
    VALUES ('ci-player', 'w_ci', 'MMK', 'ACTIVE')
  `);
  const money = new MoneyService({ mode: "TEST" });
  await money.seed("ci-player", "MMK", 100);

  const before = await getCheckinStatus(db, "ci-player");
  assert.equal(before.claimable, true);

  const first = await claimCheckin(db, "ci-player", money);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.balanceAfterMinor, 150);

  const after = await getCheckinStatus(db, "ci-player");
  assert.equal(after.claimed, true);
  assert.equal(after.claimable, false);

  const second = await claimCheckin(db, "ci-player", money);
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.alreadyClaimed, true);
  assert.equal(second.balanceAfterMinor, 150);
});

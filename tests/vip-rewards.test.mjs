import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { createTestDb } from "./db-helper.mjs";
import {
  resetPlayerCommerceBootstrapForTests,
  ensurePlayerCommerceSchema,
} from "../lib/player-commerce-bootstrap.ts";
import { setPlayerVip } from "../lib/vip-service.ts";
import { claimRewardChest, listRewardChests, periodKeyFor } from "../lib/vip-rewards.ts";
import { MoneyService } from "../lib/money-service.ts";

test("period keys are stable for daily/weekly/monthly/level", () => {
  assert.match(periodKeyFor("DAILY", "DAILY", 1), /^daily:\d{4}-\d{2}-\d{2}$/);
  assert.match(periodKeyFor("WEEKLY", "WEEKLY", 2), /^weekly:\d{4}-W\d{2}$/);
  assert.match(periodKeyFor("MONTHLY", "MONTHLY", 3), /^monthly:\d{4}-\d{2}$/);
  assert.equal(periodKeyFor("LEVEL", "LEVEL", 4), "level:4");
});

test("VIP reward claim credits via MoneyService with idempotency", async () => {
  resetPlayerCommerceBootstrapForTests();
  const { db } = createTestDb();
  await ensurePlayerCommerceSchema(db);
  await db.run(sql`
    INSERT INTO players ("id", "wallet_adapter_ref", "currency", "status")
    VALUES ('vip-player', 'w_vip', 'MMK', 'ACTIVE')
  `);

  await setPlayerVip(db, "vip-player", {
    level: 3,
    status: "ACTIVE",
    vipExpiresAt: "2099-01-01 00:00:00",
  });

  const money = new MoneyService({ mode: "TEST" });
  await money.seed("vip-player", "MMK", 10_000);
  const before = await money.getAvailableBalance("vip-player", "MMK");

  const chests = await listRewardChests(db, "vip-player");
  const daily = chests.find((c) => c.kind === "DAILY");
  assert.ok(daily);
  assert.equal(daily.claimable, true);

  const first = await claimRewardChest(db, "vip-player", daily.id, undefined, money);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.amountMinor, daily.amountMinor);
  assert.equal(first.balanceAfterMinor, before + daily.amountMinor);

  const second = await claimRewardChest(db, "vip-player", daily.id, undefined, money);
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.alreadyClaimed, true);
  assert.equal(second.balanceAfterMinor, first.balanceAfterMinor);
});

test("inactive VIP cannot claim", async () => {
  resetPlayerCommerceBootstrapForTests();
  const { db } = createTestDb();
  await ensurePlayerCommerceSchema(db);
  await db.run(sql`
    INSERT INTO players ("id", "wallet_adapter_ref", "currency", "status")
    VALUES ('pending-player', 'w_p', 'MMK', 'ACTIVE')
  `);
  await setPlayerVip(db, "pending-player", { level: 0, status: "PENDING" });
  const chests = await listRewardChests(db, "pending-player");
  const daily = chests.find((c) => c.kind === "DAILY");
  assert.ok(daily);
  assert.equal(daily.claimable, false);
  assert.equal(daily.lockedReason, "VIP_INACTIVE");
});

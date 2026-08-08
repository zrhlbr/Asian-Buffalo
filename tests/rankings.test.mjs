import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { createTestDb } from "./db-helper.mjs";
import { ensurePlayerCommerceSchema } from "../lib/player-commerce-bootstrap.ts";
import {
  listWinRankings,
  maskNickname,
  maskPlayerId,
  parseRankingRange,
  resetRankingsCacheForTests,
} from "../lib/rankings-service.ts";

async function seedMathAndSession(db, playerId) {
  await db.run(sql`
    INSERT INTO game_math_versions ("id", "sha256", "status", "config_json")
    VALUES ('mv-rank', 'sha-rank', 'FROZEN', '{}')
    ON CONFLICT("id") DO NOTHING
  `);
  await db.run(sql`
    INSERT INTO game_sessions (
      "id", "player_id", "math_version_id", "status", "currency",
      "free_games_remaining", "expires_at"
    ) VALUES (
      ${`s_${playerId}`}, ${playerId}, 'mv-rank', 'OPEN', 'MMK', 0, '2099-01-01T00:00:00.000Z'
    )
    ON CONFLICT("id") DO NOTHING
  `);
}

async function seedPlayer(db, id, nickname = "") {
  await db.run(sql`
    INSERT INTO players ("id", "wallet_adapter_ref", "currency", "status")
    VALUES (${id}, ${`w_${id}`}, 'MMK', 'ACTIVE')
  `);
  await seedMathAndSession(db, id);
  await db.run(sql`
    INSERT INTO player_profiles ("player_id", "nickname", "avatar_id")
    VALUES (${id}, ${nickname}, 'ab-avatar-01')
  `);
}

async function seedSettledWin(db, playerId, winMinor, createdAt) {
  const id = crypto.randomUUID();
  await db.run(sql`
    INSERT INTO game_rounds (
      "id", "session_id", "player_id", "math_version_id", "idempotency_key",
      "request_hash", "status", "currency", "total_bet_minor", "total_win_minor",
      "is_free_game", "free_games_awarded", "wallet_applied", "created_at", "settled_at"
    ) VALUES (
      ${id}, ${`s_${playerId}`}, ${playerId}, 'mv-rank', ${`idem_${id}`},
      ${`hash_${id}`}, 'SETTLED', 'MMK', 100, ${winMinor},
      0, 0, 1, ${createdAt}, ${createdAt}
    )
  `);
}

test("parseRankingRange defaults and accepts today/7d/30d", () => {
  assert.equal(parseRankingRange("today"), "today");
  assert.equal(parseRankingRange("7d"), "7d");
  assert.equal(parseRankingRange("30d"), "30d");
  assert.equal(parseRankingRange("nope"), "7d");
  assert.equal(parseRankingRange(null), "7d");
});

test("maskNickname / maskPlayerId privacy", () => {
  assert.equal(maskPlayerId("abcdef"), "ab***ef");
  assert.ok(maskNickname("BuffaloKing", "p1").includes("***"));
  assert.notEqual(maskNickname("BuffaloKing", "p1"), "BuffaloKing");
});

test("listWinRankings aggregates SETTLED wins by range with rank + mask", async () => {
  resetRankingsCacheForTests();
  const { db } = createTestDb();
  await ensurePlayerCommerceSchema(db);
  await seedPlayer(db, "alice", "AliceWonder");
  await seedPlayer(db, "bob", "BobBuilder");

  const now = new Date("2026-08-07T12:00:00.000Z");
  const today = "2026-08-07T08:00:00.000Z";
  const weekAgo = "2026-08-02T08:00:00.000Z";
  const monthAgo = "2026-07-10T08:00:00.000Z";

  await seedSettledWin(db, "alice", 5000, today);
  await seedSettledWin(db, "alice", 1500, weekAgo);
  await seedSettledWin(db, "bob", 3000, today);
  await seedSettledWin(db, "bob", 9000, monthAgo);

  const todayBoard = await listWinRankings(db, {
    range: "today",
    now,
    bypassCache: true,
  });
  assert.equal(todayBoard.total, 2);
  assert.equal(todayBoard.items[0].rank, 1);
  assert.equal(todayBoard.items[0].winAmountMinor, 5000);
  assert.equal(todayBoard.items[0].game, "bull-demon-king");
  assert.equal(todayBoard.items[0].currency, "MMK");
  assert.notEqual(todayBoard.items[0].nicknameMasked, "AliceWonder");
  assert.ok(!todayBoard.items[0].playerIdMasked.includes("alice") || todayBoard.items[0].playerIdMasked.includes("***"));

  const weekBoard = await listWinRankings(db, {
    range: "7d",
    now,
    bypassCache: true,
  });
  // alice 5000+1500=6500, bob 3000 (monthAgo excluded)
  assert.equal(weekBoard.items[0].winAmountMinor, 6500);
  assert.equal(weekBoard.items[1].winAmountMinor, 3000);

  const monthBoard = await listWinRankings(db, {
    range: "30d",
    now,
    bypassCache: true,
    limit: 1,
    offset: 0,
  });
  assert.equal(monthBoard.items.length, 1);
  assert.equal(monthBoard.total, 2);
  // bob 3000+9000=12000 leads
  assert.equal(monthBoard.items[0].winAmountMinor, 12000);
});

test("listWinRankings pagination and empty board", async () => {
  resetRankingsCacheForTests();
  const { db } = createTestDb();
  await ensurePlayerCommerceSchema(db);
  const empty = await listWinRankings(db, { range: "7d", bypassCache: true });
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.items, []);

  await seedPlayer(db, "p1", "One");
  await seedPlayer(db, "p2", "Two");
  const now = new Date("2026-08-07T12:00:00.000Z");
  await seedSettledWin(db, "p1", 100, "2026-08-06T00:00:00.000Z");
  await seedSettledWin(db, "p2", 200, "2026-08-06T00:00:00.000Z");
  const page = await listWinRankings(db, {
    range: "7d",
    now,
    limit: 1,
    offset: 1,
    bypassCache: true,
  });
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].rank, 2);
  assert.equal(page.items[0].winAmountMinor, 100);
});

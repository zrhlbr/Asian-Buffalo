/**
 * Miniflare real-D1 business atomicity tests (not migration-only).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.ts";
import {
  awardFreeGamesAtomic,
  claimRoundAndReserveSession,
  releaseRejectedRoundAtomic,
} from "../lib/spin-orchestrator.ts";
import { detectSqliteDriver } from "../lib/db-atomic.ts";
import {
  PRODUCTION_FROZEN_MATH_VERSION,
  hashMathVersionConfig,
} from "../lib/math-config.ts";

function migrationSqlFiles() {
  const base = join(process.cwd(), "drizzle");
  return [
    "0000_early_power_pack.sql",
    "0001_steady_annihilus.sql",
    "0002_session_currency.sql",
    "0003_round_lease.sql",
  ].map((name) => readFileSync(join(base, name), "utf8"));
}

async function execMigration(d1, sqlText) {
  const statements = sqlText
    .split(/-->\s*statement-breakpoint\s*/g)
    .map((part) =>
      part
        .split("\n")
        .filter((line) => !/^\s*--/.test(line))
        .join("\n")
        .trim(),
    )
    .filter((part) => part.length > 0);
  await d1.batch(statements.map((sql) => d1.prepare(sql)));
}

async function withD1Drizzle(run) {
  const mf = new Miniflare({
    modules: true,
    script: `export default { fetch() { return new Response("ok"); } }`,
    d1Databases: { DB: ":memory:" },
  });
  try {
    const d1 = await mf.getD1Database("DB");
    for (const sql of migrationSqlFiles()) {
      await execMigration(d1, sql);
    }
    const db = drizzle(d1, { schema });
    assert.equal(detectSqliteDriver(db), "d1");
    // Interactive BEGIN must fail on real D1 (Codex blocker).
    await assert.rejects(() => d1.exec("BEGIN IMMEDIATE"), /D1_EXEC_ERROR|BEGIN/i);
    return await run(db, d1);
  } finally {
    await mf.dispose();
  }
}

async function seedGame(db, opts = {}) {
  const playerId = opts.playerId ?? "p1";
  const sessionId = opts.sessionId ?? "sess_d1_1";
  const freeGames = opts.freeGames ?? 0;
  const config = PRODUCTION_FROZEN_MATH_VERSION;
  const sha = await hashMathVersionConfig(config);
  await db.insert(schema.players).values({
    id: playerId,
    walletAdapterRef: `wallet_${playerId}`,
    currency: "USD",
    status: "ACTIVE",
  });
  await db.insert(schema.gameMathVersions).values({
    id: config.version,
    sha256: sha,
    status: "FROZEN",
    configJson: JSON.stringify(config),
    activatedAt: "2024-01-01T00:00:00.000Z",
  });
  await db.insert(schema.gameSessions).values({
    id: sessionId,
    playerId,
    mathVersionId: config.version,
    status: "OPEN",
    currency: "USD",
    freeGamesRemaining: freeGames,
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  return { playerId, sessionId };
}

test("detectSqliteDriver distinguishes D1 from better-sqlite3", async () => {
  const { createTestDb } = await import("./db-helper.mjs");
  const { db } = createTestDb();
  assert.equal(detectSqliteDriver(db), "better-sqlite3");
  await withD1Drizzle(async (d1db) => {
    assert.equal(detectSqliteDriver(d1db), "d1");
  });
});

test("D1 claim succeeds and reserves free game atomically", async () => {
  await withD1Drizzle(async (db) => {
    const { playerId, sessionId } = await seedGame(db, { freeGames: 2 });
    const claim = await claimRoundAndReserveSession(db, {
      playerId,
      sessionId,
      playerCurrency: "USD",
      idempotencyKey: "d1-claim-ok",
      requestHash: "hash-1",
      requestPayload: "{}",
      totalBetMinor: 50,
      claimToken: "claim_d1_1",
      leaseExpiresAt: "2099-01-01T00:00:30.000Z",
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(claim.kind, "claimed");
    assert.equal(claim.isFreeGame, true);

    const session = await db.query.gameSessions.findFirst({
      where: eq(schema.gameSessions.id, sessionId),
    });
    assert.equal(session.freeGamesRemaining, 1);

    const round = await db.query.gameRounds.findFirst({
      where: eq(schema.gameRounds.id, claim.roundId),
    });
    assert.equal(round.freeGameReserved, true);
    assert.equal(round.status, "PENDING");
  });
});

test("D1 claim mid-batch failure rolls back free-game reserve and Round", async () => {
  await withD1Drizzle(async (db) => {
    const { playerId, sessionId } = await seedGame(db, { freeGames: 2 });
    await assert.rejects(
      () =>
        claimRoundAndReserveSession(db, {
          playerId,
          sessionId,
          playerCurrency: "USD",
          idempotencyKey: "d1-claim-fault",
          requestHash: "hash-fault",
          requestPayload: "{}",
          totalBetMinor: 50,
          claimToken: "claim_fault",
          leaseExpiresAt: "2099-01-01T00:00:30.000Z",
          nowIso: "2026-01-01T00:00:00.000Z",
          faults: { afterFreeReserveBeforeClaim: true },
        }),
      /crash after free reserve/i,
    );

    const session = await db.query.gameSessions.findFirst({
      where: eq(schema.gameSessions.id, sessionId),
    });
    assert.equal(session.freeGamesRemaining, 2);
    const rounds = await db.query.gameRounds.findMany({
      where: eq(schema.gameRounds.playerId, playerId),
    });
    assert.equal(rounds.length, 0);
  });
});

test("D1 free-game decrement and Round create stay consistent", async () => {
  await withD1Drizzle(async (db) => {
    const { playerId, sessionId } = await seedGame(db, { freeGames: 1 });
    const claim = await claimRoundAndReserveSession(db, {
      playerId,
      sessionId,
      playerCurrency: "USD",
      idempotencyKey: "d1-consistent",
      requestHash: "hash-c",
      requestPayload: "{}",
      totalBetMinor: 50,
      claimToken: "claim_c",
      leaseExpiresAt: "2099-01-01T00:00:30.000Z",
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(claim.kind, "claimed");
    assert.equal(claim.isFreeGame, true);
    const session = await db.query.gameSessions.findFirst({
      where: eq(schema.gameSessions.id, sessionId),
    });
    const round = await db.query.gameRounds.findFirst({
      where: eq(schema.gameRounds.id, claim.roundId),
    });
    assert.equal(session.freeGamesRemaining, 0);
    assert.equal(round.freeGameReserved, true);
  });
});

test("D1 award mark+credit atomic; mid-batch failure rolls back both", async () => {
  await withD1Drizzle(async (db) => {
    const { playerId, sessionId } = await seedGame(db, { freeGames: 0 });
    const claim = await claimRoundAndReserveSession(db, {
      playerId,
      sessionId,
      playerCurrency: "USD",
      idempotencyKey: "d1-award",
      requestHash: "hash-a",
      requestPayload: "{}",
      totalBetMinor: 50,
      claimToken: "claim_a",
      leaseExpiresAt: "2099-01-01T00:00:30.000Z",
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(claim.kind, "claimed");

    await assert.rejects(
      () =>
        awardFreeGamesAtomic(db, {
          roundId: claim.roundId,
          claimToken: "claim_a",
          sessionId,
          playerId,
          amount: 8,
          nowIso: "2026-01-01T00:00:01.000Z",
          leaseExpiresAt: "2099-01-01T00:01:00.000Z",
          faults: { betweenAwardSteps: true },
        }),
      /between award mark and credit/i,
    );

    let round = await db.query.gameRounds.findFirst({
      where: eq(schema.gameRounds.id, claim.roundId),
    });
    let session = await db.query.gameSessions.findFirst({
      where: eq(schema.gameSessions.id, sessionId),
    });
    assert.equal(round.freeGamesAwarded, 0);
    assert.equal(session.freeGamesRemaining, 0);

    const awarded = await awardFreeGamesAtomic(db, {
      roundId: claim.roundId,
      claimToken: "claim_a",
      sessionId,
      playerId,
      amount: 8,
      nowIso: "2026-01-01T00:00:02.000Z",
      leaseExpiresAt: "2099-01-01T00:01:00.000Z",
    });
    assert.equal(awarded, true);
    round = await db.query.gameRounds.findFirst({
      where: eq(schema.gameRounds.id, claim.roundId),
    });
    session = await db.query.gameSessions.findFirst({
      where: eq(schema.gameSessions.id, sessionId),
    });
    assert.equal(round.freeGamesAwarded, 8);
    assert.equal(session.freeGamesRemaining, 8);
  });
});

test("D1 concurrent claims consume a single free game once", async () => {
  await withD1Drizzle(async (db) => {
    const { playerId, sessionId } = await seedGame(db, { freeGames: 1 });
    const base = {
      playerId,
      sessionId,
      playerCurrency: "USD",
      requestPayload: "{}",
      totalBetMinor: 50,
      leaseExpiresAt: "2099-01-01T00:00:30.000Z",
      nowIso: "2026-01-01T00:00:00.000Z",
    };
    const [a, b] = await Promise.all([
      claimRoundAndReserveSession(db, {
        ...base,
        idempotencyKey: "d1-conc-a",
        requestHash: "ha",
        claimToken: "ca",
      }),
      claimRoundAndReserveSession(db, {
        ...base,
        idempotencyKey: "d1-conc-b",
        requestHash: "hb",
        claimToken: "cb",
      }),
    ]);
    assert.equal(a.kind, "claimed");
    assert.equal(b.kind, "claimed");
    const freeCount = [a, b].filter((c) => c.isFreeGame).length;
    const paidCount = [a, b].filter((c) => !c.isFreeGame).length;
    assert.equal(freeCount, 1);
    assert.equal(paidCount, 1);

    const session = await db.query.gameSessions.findFirst({
      where: eq(schema.gameSessions.id, sessionId),
    });
    assert.equal(session.freeGamesRemaining, 0);
  });
});

test("D1 fenced release: lost token cannot restore; owner restore is atomic", async () => {
  await withD1Drizzle(async (db) => {
    const { playerId, sessionId } = await seedGame(db, { freeGames: 1 });
    const claim = await claimRoundAndReserveSession(db, {
      playerId,
      sessionId,
      playerCurrency: "USD",
      idempotencyKey: "d1-release",
      requestHash: "hr",
      requestPayload: "{}",
      totalBetMinor: 50,
      claimToken: "claim_owner",
      leaseExpiresAt: "2099-01-01T00:00:30.000Z",
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(claim.kind, "claimed");
    assert.equal(claim.isFreeGame, true);

    const lost = await releaseRejectedRoundAtomic(db, {
      roundId: claim.roundId,
      sessionId,
      playerId,
      claimToken: "claim_other",
      nowIso: "2026-01-01T00:00:01.000Z",
    });
    assert.equal(lost.restored, false);
    assert.equal(lost.deleted, false);

    let session = await db.query.gameSessions.findFirst({
      where: eq(schema.gameSessions.id, sessionId),
    });
    assert.equal(session.freeGamesRemaining, 0);

    const owner = await releaseRejectedRoundAtomic(db, {
      roundId: claim.roundId,
      sessionId,
      playerId,
      claimToken: "claim_owner",
      nowIso: "2026-01-01T00:00:02.000Z",
    });
    assert.equal(owner.restored, true);
    assert.equal(owner.deleted, true);

    session = await db.query.gameSessions.findFirst({
      where: eq(schema.gameSessions.id, sessionId),
    });
    assert.equal(session.freeGamesRemaining, 1);
  });
});

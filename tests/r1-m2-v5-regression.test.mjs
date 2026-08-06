import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.ts";
import {
  awardFreeGamesAtomic,
  claimRoundAndReserveSession,
  orchestrateSpin,
  renewLease,
  takeOverStalePending,
} from "../lib/spin-orchestrator.ts";
import { INITIAL_MATH_VERSION, hashMathVersionConfig } from "../lib/math-config.ts";
import { canonicalizeSpinRequest, hashSpinRequest } from "../lib/request-hash.ts";
import { TestRoundStore } from "../lib/round-store.ts";
import { TestWalletAdapter } from "../lib/wallet-adapter.ts";
import { createTestDb } from "./db-helper.mjs";
import { testExecutableMath } from "./helpers/test-executable-math.mjs";

async function seed(db, freeGames = 0) {
  const sha = await hashMathVersionConfig(INITIAL_MATH_VERSION);
  await db.insert(schema.players).values({
    id: "v5_player",
    walletAdapterRef: "wallet_v5_player",
    currency: "USD",
    status: "ACTIVE",
  });
  await db.insert(schema.gameMathVersions).values({
    id: INITIAL_MATH_VERSION.version,
    sha256: sha,
    status: "DRAFT",
    configJson: JSON.stringify(INITIAL_MATH_VERSION),
  });
  await db.insert(schema.gameSessions).values({
    id: "v5_session",
    playerId: "v5_player",
    mathVersionId: INITIAL_MATH_VERSION.version,
    status: "OPEN",
    currency: "USD",
    freeGamesRemaining: freeGames,
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
}

async function claim(db, idempotencyKey, claimToken, nowIso, leaseExpiresAt) {
  return claimRoundAndReserveSession(db, {
    playerId: "v5_player",
    sessionId: "v5_session",
    playerCurrency: "USD",
    idempotencyKey,
    requestHash: `hash-${idempotencyKey}`,
    requestPayload: "{}",
    totalBetMinor: 50,
    claimToken,
    leaseExpiresAt,
    nowIso,
  });
}

test("R1-M2 v5: stale lease snapshot cannot steal after owner renewal", async () => {
  const { db } = createTestDb();
  await seed(db);
  const original = await claim(
    db,
    "lease-renew-race",
    "owner-token",
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T00:00:10.000Z",
  );
  assert.equal(original.kind, "claimed");
  const staleSnapshot = await db.query.gameRounds.findFirst({
    where: eq(schema.gameRounds.id, original.roundId),
  });

  await renewLease(
    db,
    original.roundId,
    "owner-token",
    "2026-01-01T00:00:11.000Z",
    "2026-01-01T00:10:00.000Z",
  );

  const stolen = await takeOverStalePending(
    db,
    staleSnapshot,
    "new-token",
    "2026-01-01T00:01:00.000Z",
    "2026-01-01T00:00:20.000Z",
    Date.parse("2026-01-01T00:00:20.000Z"),
  );
  assert.equal(stolen, false);

  const current = await db.query.gameRounds.findFirst({
    where: eq(schema.gameRounds.id, original.roundId),
  });
  assert.equal(current.claimToken, "owner-token");
  assert.equal(current.leaseExpiresAt, "2026-01-01T00:10:00.000Z");
});

test("R1-M2 v5: replayed free-game award does not credit twice", async () => {
  const { db } = createTestDb();
  await seed(db);
  const original = await claim(
    db,
    "award-replay",
    "award-token",
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T00:01:00.000Z",
  );
  assert.equal(original.kind, "claimed");

  const award = {
    roundId: original.roundId,
    claimToken: "award-token",
    sessionId: "v5_session",
    playerId: "v5_player",
    amount: 8,
    nowIso: "2026-01-01T00:00:01.000Z",
    leaseExpiresAt: "2026-01-01T00:01:00.000Z",
  };
  assert.equal(await awardFreeGamesAtomic(db, award), true);
  assert.equal(await awardFreeGamesAtomic(db, award), false);

  const session = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, "v5_session"),
  });
  assert.equal(session.freeGamesRemaining, 8);
});

test("R1-M2 v5: expired paid PENDING without outcome recovers and settles once", async () => {
  const { db } = createTestDb();
  await seed(db);
  const publicSpin = {
    sessionId: "v5_session",
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "paid-pre-outcome-crash",
  };
  const requestHash = await hashSpinRequest(publicSpin);
  const canonicalPayload = canonicalizeSpinRequest(publicSpin);
  const original = await claimRoundAndReserveSession(db, {
    playerId: "v5_player",
    sessionId: "v5_session",
    playerCurrency: "USD",
    idempotencyKey: publicSpin.idempotencyKey,
    requestHash,
    requestPayload: canonicalPayload,
    totalBetMinor: 50,
    claimToken: "dead-worker-token",
    leaseExpiresAt: "2026-01-01T00:00:10.000Z",
    nowIso: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(original.kind, "claimed");
  assert.equal(original.isFreeGame, false);

  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("v5_player", "USD", 10_000);
  const services = {
    walletAdapter: wallet,
    roundStore: new TestRoundStore(),
    allowRealMoney: false,
    mathConfig: testExecutableMath,
    clock: { now: () => new Date("2026-01-01T00:01:00.000Z") },
  };
  const input = {
    playerId: "v5_player",
    playerCurrency: "USD",
    publicSpin,
    requestHash,
    canonicalPayload,
  };

  const recovered = await orchestrateSpin(db, services, input);
  assert.equal(recovered.kind, "ok");
  const balanceAfter = await wallet.getAvailableBalance("v5_player", "USD");

  const replay = await orchestrateSpin(db, services, input);
  assert.equal(replay.kind, "idempotent");
  assert.deepEqual(replay.result, recovered.result);
  assert.equal(await wallet.getAvailableBalance("v5_player", "USD"), balanceAfter);

  const round = await db.query.gameRounds.findFirst({
    where: eq(schema.gameRounds.id, original.roundId),
  });
  assert.equal(round.status, "SETTLED");
  assert.ok(round.outcomeJson);
});

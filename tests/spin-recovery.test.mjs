import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { handleCreateSession, handleSpin } from "../lib/api-handlers.ts";
import { TestRoundStore } from "../lib/round-store.ts";
import {
  TestWalletAdapter,
  WalletResultUnknownError,
  InsufficientBalanceError,
} from "../lib/wallet-adapter.ts";
import {
  LEASE_TTL_MS,
  WALLET_LEASE_TTL_MS,
  renewLease,
  takeOverStalePending,
  releaseRejectedRoundAtomic,
} from "../lib/spin-orchestrator.ts";
import { createTestDb } from "./db-helper.mjs";
import { TestIdentityProvider } from "./helpers/test-identity-provider.mjs";
import { testExecutableMath } from "./helpers/test-executable-math.mjs";
import * as schema from "../db/schema.ts";

function makeAuth(playerId = "p1") {
  return {
    identityProvider: new TestIdentityProvider(playerId),
    request: new Request("http://localhost/v1/game/test"),
  };
}

function makeServices(wallet, extras = {}) {
  return {
    walletAdapter: wallet,
    roundStore: extras.roundStore ?? new TestRoundStore(),
    allowRealMoney: false,
    mathConfig: extras.mathConfig ?? testExecutableMath,
    ...extras,
  };
}

function fixedClock(iso) {
  return { now: () => new Date(iso) };
}

async function seedPlayer(db, playerId = "p1", currency = "USD") {
  await db.insert(schema.players).values({
    id: playerId,
    walletAdapterRef: `wallet_${playerId}`,
    currency,
    status: "ACTIVE",
  });
}

async function parseJson(response) {
  return response.json();
}

async function openSession(db, playerId = "p1", clock) {
  const response = await handleCreateSession(db, makeAuth(playerId), {}, clock);
  assert.equal(response.status, 200);
  return parseJson(response);
}

const scatterGrid = [
  ["scatter", "nine", "nine", "nine"],
  ["scatter", "nine", "nine", "nine"],
  ["scatter", "nine", "nine", "nine"],
  ["nine", "nine", "nine", "nine"],
  ["nine", "nine", "nine", "nine"],
];

const deadGrid = [
  ["nine", "ten", "j", "q"],
  ["ten", "j", "q", "k"],
  ["j", "q", "k", "a"],
  ["q", "k", "a", "nine"],
  ["k", "a", "nine", "ten"],
];

class FailingRoundStore extends TestRoundStore {
  constructor(failTimes = 1) {
    super();
    this.failTimes = failTimes;
    this.attempts = 0;
  }
  async saveRound(result) {
    this.attempts += 1;
    if (this.attempts <= this.failTimes) {
      throw new Error("RoundStore injected failure");
    }
    return super.saveRound(result);
  }
}

test("wallet success + RoundStore failure leaves recoverable PENDING with wallet_applied", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const session = await openSession(db);
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const store = new FailingRoundStore(1);
  const payload = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "wallet-ok-store-fail",
  };

  const first = await handleSpin(db, makeAuth(), makeServices(wallet, { roundStore: store }), payload);
  assert.equal(first.status, 500);
  const balanceAfterFail = await wallet.getAvailableBalance("p1", "USD");
  assert.ok(balanceAfterFail < 10_000 || balanceAfterFail !== 10_000);

  const pending = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, "p1"),
      eq(schema.gameRounds.idempotencyKey, payload.idempotencyKey),
    ),
  });
  assert.ok(pending);
  assert.equal(pending.status, "PENDING");
  assert.equal(pending.walletApplied, true);

  const second = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      roundStore: store,
      clock: fixedClock(new Date(Date.now() + LEASE_TTL_MS + 1_000).toISOString()),
    }),
    payload,
  );
  assert.equal(second.status, 200);
  const body = await parseJson(second);
  assert.equal(body.idempotencyKey, payload.idempotencyKey);
  assert.equal(await wallet.getAvailableBalance("p1", "USD"), balanceAfterFail);

  const settled = await db.query.gameRounds.findFirst({
    where: eq(schema.gameRounds.id, body.roundId),
  });
  assert.equal(settled.status, "SETTLED");
});

test("wallet success + DB settle finalize failure recovers without double debit", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const session = await openSession(db);
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const payload = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "wallet-ok-db-fail",
  };

  let failFinalize = true;
  const first = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      faults: {
        beforeFinalize: () => {
          if (failFinalize) {
            failFinalize = false;
            throw new Error("DB settle injected failure");
          }
        },
      },
    }),
    payload,
  );
  assert.equal(first.status, 500);
  const balance = await wallet.getAvailableBalance("p1", "USD");

  const row = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, "p1"),
      eq(schema.gameRounds.idempotencyKey, payload.idempotencyKey),
    ),
  });
  assert.equal(row.walletApplied, true);
  assert.equal(row.status, "PENDING");

  const second = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      clock: fixedClock(new Date(Date.now() + LEASE_TTL_MS + 1_000).toISOString()),
    }),
    payload,
  );
  assert.equal(second.status, 200);
  assert.equal(await wallet.getAvailableBalance("p1", "USD"), balance);
});

test("free-game consume then crash recovers without double consume", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const session = await openSession(db);
  await db
    .update(schema.gameSessions)
    .set({ freeGamesRemaining: 1 })
    .where(eq(schema.gameSessions.id, session.sessionId));

  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const payload = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "free-crash-recover",
  };

  const first = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      testFixedGrid: deadGrid,
      faults: {
        afterOutcomePersist: () => {
          throw new Error("crash after free-game reserve + outcome");
        },
      },
    }),
    payload,
  );
  assert.equal(first.status, 500);

  const midSession = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  // Free game stays consumed; recovery must not consume again.
  assert.equal(midSession.freeGamesRemaining, 0);

  const midRound = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, "p1"),
      eq(schema.gameRounds.idempotencyKey, payload.idempotencyKey),
    ),
  });
  assert.ok(midRound);
  assert.equal(midRound.status, "PENDING");
  assert.equal(midRound.freeGameReserved, true);
  assert.ok(midRound.outcomeJson);
  const persisted = JSON.parse(midRound.outcomeJson);
  assert.equal(persisted.awardedFreeGames, 0);

  const second = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      testFixedGrid: deadGrid,
      clock: fixedClock(new Date(Date.now() + LEASE_TTL_MS + 1_000).toISOString()),
    }),
    payload,
  );
  assert.equal(second.status, 200);
  const body = await parseJson(second);
  assert.equal(body.isFreeGame, true);
  assert.equal(body.awardedFreeGames, 0);

  const endSession = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  assert.equal(endSession.freeGamesRemaining, 0);
});

test("free-game award then finalize failure recovers without double award", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const session = await openSession(db);
  await db
    .update(schema.gameSessions)
    .set({ freeGamesRemaining: 1 })
    .where(eq(schema.gameSessions.id, session.sessionId));

  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const payload = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "award-then-finalize-fail",
  };

  let blow = true;
  const first = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      testFixedGrid: scatterGrid,
      faults: {
        afterFreeGameAward: () => {
          if (blow) {
            blow = false;
            throw new Error("crash after free-game award");
          }
        },
      },
    }),
    payload,
  );
  assert.equal(first.status, 500);

  const afterAward = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  // 1 consumed + 8 awarded = 8
  assert.equal(afterAward.freeGamesRemaining, 8);

  const second = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      testFixedGrid: scatterGrid,
      clock: fixedClock(new Date(Date.now() + LEASE_TTL_MS + 1_000).toISOString()),
    }),
    payload,
  );
  assert.equal(second.status, 200);
  const body = await parseJson(second);
  assert.equal(body.awardedFreeGames, 8);

  const end = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  assert.equal(end.freeGamesRemaining, 8);
});

test("stale PENDING lease can be taken over safely", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const t0 = "2026-06-01T00:00:00.000Z";
  const session = await openSession(db, "p1", fixedClock(t0));
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const payload = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "stale-pending",
  };

  const stuck = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      clock: fixedClock(t0),
      faults: {
        afterOutcomePersist: () => {
          throw new Error("worker died holding lease");
        },
      },
    }),
    payload,
  );
  assert.equal(stuck.status, 500);

  const stranded = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, "p1"),
      eq(schema.gameRounds.idempotencyKey, payload.idempotencyKey),
    ),
  });
  assert.ok(stranded);
  assert.equal(stranded.status, "PENDING");

  // Active lease must reject duplicate workers.
  const busy = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, { clock: fixedClock("2026-06-01T00:00:10.000Z") }),
    payload,
  );
  assert.equal(busy.status, 409);
  assert.equal((await parseJson(busy)).error.code, "IDEMPOTENCY_IN_PROGRESS");

  const recovered = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, { clock: fixedClock("2026-06-01T00:01:00.000Z") }),
    payload,
  );
  assert.equal(recovered.status, 200);
  const body = await parseJson(recovered);
  assert.equal(body.roundId, stranded.id);

  const again = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, { clock: fixedClock("2026-06-01T00:02:00.000Z") }),
    payload,
  );
  assert.equal(again.status, 200);
  assert.deepEqual(await parseJson(again), body);
  assert.equal(await wallet.getAvailableBalance("p1", "USD"), 10_000 - 50 + body.totalWinMinor);
});

test("identical concurrent requests settle exactly once", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const session = await openSession(db);
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 50_000);
  const payload = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "concurrent-same",
  };

  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      handleSpin(db, makeAuth(), makeServices(wallet), payload),
    ),
  );
  const ok = results.filter((r) => r.status === 200);
  const busy = results.filter((r) => r.status === 409);
  assert.ok(ok.length >= 1);
  assert.equal(ok.length + busy.length, results.length);

  const bodies = await Promise.all(ok.map((r) => parseJson(r)));
  for (const body of bodies) {
    assert.deepEqual(body, bodies[0]);
  }

  const rounds = await db.query.gameRounds.findMany({
    where: and(
      eq(schema.gameRounds.playerId, "p1"),
      eq(schema.gameRounds.idempotencyKey, payload.idempotencyKey),
    ),
  });
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].status, "SETTLED");

  const expected = 50_000 - bodies[0].totalBetMinor + bodies[0].totalWinMinor;
  assert.equal(await wallet.getAvailableBalance("p1", "USD"), expected);
});

test("same key different hash concurrent conflict", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const session = await openSession(db);
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 50_000);

  const a = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "conflict-concurrent",
  };
  const b = { ...a, betLevel: 2 };

  const [ra, rb] = await Promise.all([
    handleSpin(db, makeAuth(), makeServices(wallet), a),
    handleSpin(db, makeAuth(), makeServices(wallet), b),
  ]);
  const statuses = [ra.status, rb.status].sort();
  assert.ok(statuses.includes(200));
  assert.ok(statuses.includes(409));
  const conflict = ra.status === 409 ? ra : rb;
  assert.equal((await parseJson(conflict)).error.code, "IDEMPOTENCY_CONFLICT");
});

test("SETTLED returns original result after session closed / expired / currency change", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const clock = fixedClock("2026-07-01T00:00:00.000Z");
  const session = await openSession(db, "p1", clock);
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const payload = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "settled-survives-session",
  };

  const first = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, { clock }),
    payload,
  );
  assert.equal(first.status, 200);
  const original = await parseJson(first);

  await db
    .update(schema.gameSessions)
    .set({ status: "CLOSED" })
    .where(eq(schema.gameSessions.id, session.sessionId));
  const afterClosed = await parseJson(
    await handleSpin(db, makeAuth(), makeServices(wallet, { clock }), payload),
  );
  assert.deepEqual(afterClosed, original);

  await db
    .update(schema.gameSessions)
    .set({ status: "OPEN", expiresAt: "2026-07-01T00:00:01.000Z" })
    .where(eq(schema.gameSessions.id, session.sessionId));
  const afterExpired = await parseJson(
    await handleSpin(
      db,
      makeAuth(),
      makeServices(wallet, { clock: fixedClock("2026-07-01T01:00:00.000Z") }),
      payload,
    ),
  );
  assert.deepEqual(afterExpired, original);

  await db.update(schema.players).set({ currency: "THB" }).where(eq(schema.players.id, "p1"));
  const afterCurrency = await parseJson(
    await handleSpin(
      db,
      makeAuth(),
      makeServices(wallet, { clock: fixedClock("2026-07-01T01:00:00.000Z") }),
      payload,
    ),
  );
  assert.deepEqual(afterCurrency, original);
});

test("illegal expires_at fails closed as SESSION_UNAVAILABLE", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const session = await openSession(db);
  await db
    .update(schema.gameSessions)
    .set({ expiresAt: "not-a-date" })
    .where(eq(schema.gameSessions.id, session.sessionId));

  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const response = await handleSpin(db, makeAuth(), makeServices(wallet), {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "bad-expires",
  });
  assert.equal(response.status, 403);
  assert.equal((await parseJson(response)).error.code, "SESSION_UNAVAILABLE");

  const rounds = await db.query.gameRounds.findMany({
    where: eq(schema.gameRounds.playerId, "p1"),
  });
  assert.equal(rounds.length, 0);
});

test("invalid business params do not occupy idempotency key", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const session = await openSession(db);
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);

  const bad = await handleSpin(db, makeAuth(), makeServices(wallet), {
    sessionId: session.sessionId,
    roomBase: 999,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "reuse-after-400",
  });
  assert.equal(bad.status, 400);
  assert.equal((await parseJson(bad)).error.code, "VALIDATION_ERROR");

  const poisoned = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, "p1"),
      eq(schema.gameRounds.idempotencyKey, "reuse-after-400"),
    ),
  });
  assert.equal(poisoned, undefined);

  const good = await handleSpin(db, makeAuth(), makeServices(wallet), {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "reuse-after-400",
  });
  assert.equal(good.status, 200);
});

test("wallet settlement committed then timeout keeps winnings without restoring free games", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const session = await openSession(db);
  await db
    .update(schema.gameSessions)
    .set({ freeGamesRemaining: 1 })
    .where(eq(schema.gameSessions.id, session.sessionId));

  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  wallet.afterSettlementCommitted = async () => {
    throw new WalletResultUnknownError("wallet timeout after commit");
  };

  const payload = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "wallet-timeout-after-commit",
  };

  const first = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, { testFixedGrid: deadGrid }),
    payload,
  );
  assert.equal(first.status, 500);

  const midSession = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  // Free game remains consumed; must NOT restore while wallet may have paid out.
  assert.equal(midSession.freeGamesRemaining, 0);

  const balanceAfterTimeout = await wallet.getAvailableBalance("p1", "USD");
  // Free spin: stake 0, win may be 0 with deadGrid â€?balance unchanged or +win, never restored free+win.
  assert.ok(balanceAfterTimeout >= 10_000);

  const pending = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, "p1"),
      eq(schema.gameRounds.idempotencyKey, payload.idempotencyKey),
    ),
  });
  assert.ok(pending);
  assert.equal(pending.status, "PENDING");
  assert.equal(pending.freeGameReserved, true);
  // markWalletApplied happens after settle returns â€?timeout before return means not marked.
  assert.equal(pending.walletApplied, false);

  wallet.afterSettlementCommitted = undefined;
  const second = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      testFixedGrid: deadGrid,
      clock: fixedClock(
        new Date(Date.now() + WALLET_LEASE_TTL_MS + 1_000).toISOString(),
      ),
    }),
    payload,
  );
  assert.equal(second.status, 200);
  assert.equal(await wallet.getAvailableBalance("p1", "USD"), balanceAfterTimeout);
  const end = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  assert.equal(end.freeGamesRemaining, 0);
});

test("free-game reserve before round insert crash rolls back atomically", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const session = await openSession(db);
  await db
    .update(schema.gameSessions)
    .set({ freeGamesRemaining: 2 })
    .where(eq(schema.gameSessions.id, session.sessionId));

  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const response = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      faults: {
        afterFreeReserveBeforeClaim: true,
      },
    }),
    {
      sessionId: session.sessionId,
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "atomic-claim-crash",
    },
  );
  assert.equal(response.status, 500);

  const row = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  assert.equal(row.freeGamesRemaining, 2);
  const rounds = await db.query.gameRounds.findMany({
    where: eq(schema.gameRounds.playerId, "p1"),
  });
  assert.equal(rounds.length, 0);
});

test("award mark/credit mid-TX failure rolls back; retry awards once", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const session = await openSession(db);
  await db
    .update(schema.gameSessions)
    .set({ freeGamesRemaining: 1 })
    .where(eq(schema.gameSessions.id, session.sessionId));

  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const payload = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "atomic-award-midfail",
  };

  const first = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      testFixedGrid: scatterGrid,
      faults: {
        betweenAwardSteps: true,
      },
    }),
    payload,
  );
  assert.equal(first.status, 500);

  const midRound = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, "p1"),
      eq(schema.gameRounds.idempotencyKey, payload.idempotencyKey),
    ),
  });
  assert.equal(midRound.walletApplied, true);
  assert.equal(midRound.freeGamesAwarded, 0, "mark must roll back with credit");

  const midSession = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  // 1 consumed, award rolled back â†?0 remaining
  assert.equal(midSession.freeGamesRemaining, 0);

  const second = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      testFixedGrid: scatterGrid,
      clock: fixedClock(new Date(Date.now() + LEASE_TTL_MS + 1_000).toISOString()),
    }),
    payload,
  );
  assert.equal(second.status, 200);
  const body = await parseJson(second);
  assert.equal(body.awardedFreeGames, 8);

  const end = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  assert.equal(end.freeGamesRemaining, 8);

  const settled = await db.query.gameRounds.findFirst({
    where: eq(schema.gameRounds.id, body.roundId),
  });
  assert.equal(settled.freeGamesAwarded, 8);
});

test("stale worker is fenced after lease takeover by new worker", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const t0 = "2026-08-01T00:00:00.000Z";
  const session = await openSession(db, "p1", fixedClock(t0));
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const payload = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "fencing-stale-worker",
  };

  const stuck = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      clock: fixedClock(t0),
      testFixedGrid: deadGrid,
      faults: {
        afterOutcomePersist: () => {
          throw new Error("old worker stalled after outcome");
        },
      },
    }),
    payload,
  );
  assert.equal(stuck.status, 500);

  const stranded = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, "p1"),
      eq(schema.gameRounds.idempotencyKey, payload.idempotencyKey),
    ),
  });
  assert.ok(stranded);
  const oldToken = stranded.claimToken;

  // New worker takes over after lease expiry.
  const recovered = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      testFixedGrid: deadGrid,
      clock: fixedClock("2026-08-01T00:01:00.000Z"),
    }),
    payload,
  );
  assert.equal(recovered.status, 200);
  const body = await parseJson(recovered);

  const after = await db.query.gameRounds.findFirst({
    where: eq(schema.gameRounds.id, body.roundId),
  });
  assert.equal(after.status, "SETTLED");
  assert.notEqual(after.claimToken, oldToken);

  // Old worker tries to renew / write with fenced token â€?must fail.
  await assert.rejects(
    () =>
      renewLease(
        db,
        stranded.id,
        oldToken,
        "2026-08-01T00:02:00.000Z",
        "2026-08-01T00:03:00.000Z",
      ),
    /Lease|Fenced/i,
  );

  // Takeover with stale observed token also fails once settled/new token owns it.
  const taken = await takeOverStalePending(
    db,
    { ...stranded, claimToken: oldToken, status: "PENDING" },
    "claim_too_late",
    "2026-08-01T00:05:00.000Z",
    "2026-08-01T00:04:00.000Z",
    Date.parse("2026-08-01T00:04:00.000Z"),
  );
  assert.equal(taken, false);
});

test("unparseable lease_expires_at is treated as expired (not forever-valid)", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const session = await openSession(db);
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);

  const { canonicalizeSpinRequest, hashSpinRequest } = await import(
    "../lib/request-hash.ts"
  );
  const payload = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "bad-lease-expiry",
  };
  const hash = await hashSpinRequest(payload);
  await db.insert(schema.gameRounds).values({
    id: "round_bad_lease",
    sessionId: session.sessionId,
    playerId: "p1",
    mathVersionId: "ab-math-1.0.0",
    idempotencyKey: payload.idempotencyKey,
    requestHash: hash,
    requestPayload: canonicalizeSpinRequest(payload),
    status: "PENDING",
    currency: "USD",
    totalBetMinor: 50,
    isFreeGame: false,
    freeGameReserved: false,
    freeGamesAwarded: 0,
    walletApplied: false,
    claimToken: "claim_old",
    leaseExpiresAt: "not-a-timestamp",
    updatedAt: new Date().toISOString(),
    outcomeJson: JSON.stringify({
      roundId: "round_bad_lease",
      sessionId: session.sessionId,
      playerId: "p1",
      mathVersion: "ab-math-1.0.0",
      idempotencyKey: payload.idempotencyKey,
      currency: "USD",
      totalBetMinor: 50,
      totalWinMinor: 0,
      isFreeGame: false,
      freeGamesRemaining: 0,
      awardedFreeGames: 0,
      grid: [],
      winningPositions: [],
      lineWins: [],
      scatterCount: 0,
      scatterWin: 0,
      multiplier: 1,
    }),
  });

  const response = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, { testFixedGrid: deadGrid }),
    payload,
  );
  assert.equal(response.status, 200);
});

test("Codex: old worker clear-reject cannot restore free game after lease takeover", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const t0 = "2026-09-01T00:00:00.000Z";
  const session = await openSession(db, "p1", fixedClock(t0));
  await db
    .update(schema.gameSessions)
    .set({ freeGamesRemaining: 1 })
    .where(eq(schema.gameSessions.id, session.sessionId));

  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const payload = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "old-worker-reject-after-takeover",
  };

  // Old worker persists outcome then stalls (holds lease).
  const stuck = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      clock: fixedClock(t0),
      testFixedGrid: deadGrid,
      faults: {
        afterOutcomePersist: () => {
          throw new Error("old worker delayed in wallet");
        },
      },
    }),
    payload,
  );
  assert.equal(stuck.status, 500);

  const stranded = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, "p1"),
      eq(schema.gameRounds.idempotencyKey, payload.idempotencyKey),
    ),
  });
  assert.ok(stranded);
  const oldToken = stranded.claimToken;
  assert.equal(stranded.freeGameReserved, true);

  // New worker takes over after lease expiry and settles successfully.
  const recovered = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      testFixedGrid: deadGrid,
      clock: fixedClock("2026-09-01T00:01:00.000Z"),
    }),
    payload,
  );
  assert.equal(recovered.status, 200);

  const afterSettle = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  assert.equal(afterSettle.freeGamesRemaining, 0);

  // Old worker later receives a clear wallet rejection and attempts release.
  const release = await releaseRejectedRoundAtomic(db, {
    roundId: stranded.id,
    sessionId: session.sessionId,
    playerId: "p1",
    claimToken: oldToken,
    nowIso: "2026-09-01T00:02:00.000Z",
  });
  assert.equal(release.restored, false);
  assert.equal(release.deleted, false);

  const end = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  assert.equal(end.freeGamesRemaining, 0, "old worker must not restore free games");
});

test("Codex: restore+delete mid-batch fault rolls back both sides", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const session = await openSession(db);
  await db
    .update(schema.gameSessions)
    .set({ freeGamesRemaining: 0 })
    .where(eq(schema.gameSessions.id, session.sessionId));

  const { canonicalizeSpinRequest, hashSpinRequest } = await import(
    "../lib/request-hash.ts"
  );
  const payload = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "restore-delete-fault",
  };
  const hash = await hashSpinRequest(payload);
  await db.insert(schema.gameRounds).values({
    id: "round_restore_fault",
    sessionId: session.sessionId,
    playerId: "p1",
    mathVersionId: "ab-math-1.0.0",
    idempotencyKey: payload.idempotencyKey,
    requestHash: hash,
    requestPayload: canonicalizeSpinRequest(payload),
    status: "PENDING",
    currency: "USD",
    totalBetMinor: 50,
    isFreeGame: true,
    freeGameReserved: true,
    freeGamesAwarded: 0,
    walletApplied: false,
    claimToken: "claim_restore",
    leaseExpiresAt: "2099-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
  });

  await assert.rejects(
    () =>
      releaseRejectedRoundAtomic(db, {
        roundId: "round_restore_fault",
        sessionId: session.sessionId,
        playerId: "p1",
        claimToken: "claim_restore",
        nowIso: new Date().toISOString(),
        faults: { betweenRestoreAndDelete: true },
      }),
    /fault between free-game restore and round delete/i,
  );

  const sessionRow = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  assert.equal(sessionRow.freeGamesRemaining, 0);
  const round = await db.query.gameRounds.findFirst({
    where: eq(schema.gameRounds.id, "round_restore_fault"),
  });
  assert.ok(round);
  assert.equal(round.status, "PENDING");
});

test("lost claim_token cannot restore free games; repeat reject is idempotent", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const session = await openSession(db);
  await db
    .update(schema.gameSessions)
    .set({ freeGamesRemaining: 0 })
    .where(eq(schema.gameSessions.id, session.sessionId));

  const { canonicalizeSpinRequest, hashSpinRequest } = await import(
    "../lib/request-hash.ts"
  );
  const payload = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "token-fence-restore",
  };
  const hash = await hashSpinRequest(payload);
  await db.insert(schema.gameRounds).values({
    id: "round_token_fence",
    sessionId: session.sessionId,
    playerId: "p1",
    mathVersionId: "ab-math-1.0.0",
    idempotencyKey: payload.idempotencyKey,
    requestHash: hash,
    requestPayload: canonicalizeSpinRequest(payload),
    status: "PENDING",
    currency: "USD",
    totalBetMinor: 50,
    isFreeGame: true,
    freeGameReserved: true,
    freeGamesAwarded: 0,
    walletApplied: false,
    claimToken: "claim_owner",
    leaseExpiresAt: "2099-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
  });

  const lost = await releaseRejectedRoundAtomic(db, {
    roundId: "round_token_fence",
    sessionId: session.sessionId,
    playerId: "p1",
    claimToken: "claim_stale",
    nowIso: new Date().toISOString(),
  });
  assert.equal(lost.restored, false);
  assert.equal(lost.deleted, false);

  const owner = await releaseRejectedRoundAtomic(db, {
    roundId: "round_token_fence",
    sessionId: session.sessionId,
    playerId: "p1",
    claimToken: "claim_owner",
    nowIso: new Date().toISOString(),
  });
  assert.equal(owner.restored, true);
  assert.equal(owner.deleted, true);

  const again = await releaseRejectedRoundAtomic(db, {
    roundId: "round_token_fence",
    sessionId: session.sessionId,
    playerId: "p1",
    claimToken: "claim_owner",
    nowIso: new Date().toISOString(),
  });
  assert.equal(again.restored, false);
  assert.equal(again.deleted, false);

  const end = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  assert.equal(end.freeGamesRemaining, 1);

  // Clear-reject path through handleSpin with insufficient balance also uses atomic release.
  void InsufficientBalanceError;
});

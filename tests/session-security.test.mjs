import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  handleCreateSession,
  handleSpin,
} from "../lib/api-handlers.ts";
import { TestRoundStore } from "../lib/round-store.ts";
import { TestWalletAdapter } from "../lib/wallet-adapter.ts";
import { createTestDb } from "./db-helper.mjs";
import { TestIdentityProvider } from "./helpers/test-identity-provider.mjs";
import { testExecutableMath } from "./helpers/test-executable-math.mjs";
import * as schema from "../db/schema.ts";

function makeAuth(playerId) {
  return {
    identityProvider: new TestIdentityProvider(playerId),
    request: new Request("http://localhost/v1/game/test"),
  };
}

function makeServices(wallet = new TestWalletAdapter(), extras = {}) {
  return {
    walletAdapter: wallet,
    roundStore: new TestRoundStore(),
    allowRealMoney: false,
    mathConfig: extras.mathConfig ?? testExecutableMath,
    ...extras,
  };
}

function fixedClock(iso) {
  return { now: () => new Date(iso) };
}

async function seedPlayer(db, playerId, currency = "USD", status = "ACTIVE") {
  await db.insert(schema.players).values({
    id: playerId,
    walletAdapterRef: `wallet_${playerId}`,
    currency,
    status,
  });
}

async function parseJson(response) {
  return response.json();
}

async function openSession(db, playerId, clock) {
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

test("CreateSession non-empty body is rejected", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1");
  const response = await handleCreateSession(db, makeAuth("p1"), { foo: 1 });
  assert.equal(response.status, 400);
  assert.equal((await parseJson(response)).error.code, "INVALID_REQUEST");
});

test("Spin rejects string numbers, booleans, decimals, NaN, and Infinity", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1");
  const session = await openSession(db, "p1");
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const base = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "bad-types",
  };

  for (const [field, value] of [
    ["roomBase", "50"],
    ["betLevel", true],
    ["betMultiplier", 1.5],
    ["roomBase", Number.NaN],
    ["betLevel", Number.POSITIVE_INFINITY],
  ]) {
    const payload = { ...base, idempotencyKey: `bad-${field}-${String(value)}`, [field]: value };
    const response = await handleSpin(db, makeAuth("p1"), makeServices(wallet), payload);
    assert.equal(response.status, 400, `${field}=${String(value)}`);
    assert.equal((await parseJson(response)).error.code, "INVALID_REQUEST");
  }
});

test("Spin rejects all unknown / forged fields", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1");
  const session = await openSession(db, "p1");
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);

  const forbidden = [
    "playerId",
    "currency",
    "mathVersionId",
    "isFreeGame",
    "freeGamesRemainingBefore",
    "freeGames",
    "grid",
    "symbols",
    "winscore",
    "winScore",
    "multiplier",
    "balanceAfter",
    "totalWin",
  ];

  for (const field of forbidden) {
    const response = await handleSpin(db, makeAuth("p1"), makeServices(wallet), {
      sessionId: session.sessionId,
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: `forbid-${field}`,
      [field]: field === "isFreeGame" ? true : 1,
    });
    assert.equal(response.status, 400, field);
    assert.equal((await parseJson(response)).error.code, "INVALID_REQUEST");
  }
});

test("player can only use own OPEN session; foreign session is 404", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "owner");
  await seedPlayer(db, "intruder");
  const ownerSession = await openSession(db, "owner");
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("intruder", "USD", 10_000);

  const response = await handleSpin(db, makeAuth("intruder"), makeServices(wallet), {
    sessionId: ownerSession.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "foreign-session",
  });
  assert.equal(response.status, 404);
  assert.equal((await parseJson(response)).error.code, "SESSION_NOT_FOUND");
});

test("CLOSED / REVOKED / expired sessions return SESSION_UNAVAILABLE", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1");
  const clock = fixedClock("2026-01-01T00:00:00.000Z");
  const session = await openSession(db, "p1", clock);
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);

  for (const status of ["CLOSED", "REVOKED"]) {
    await db
      .update(schema.gameSessions)
      .set({ status })
      .where(eq(schema.gameSessions.id, session.sessionId));
    const response = await handleSpin(
      db,
      makeAuth("p1"),
      makeServices(wallet, { clock }),
      {
        sessionId: session.sessionId,
        roomBase: 50,
        betLevel: 1,
        betMultiplier: 1,
        idempotencyKey: `status-${status}`,
      },
    );
    assert.equal(response.status, 403, status);
    assert.equal((await parseJson(response)).error.code, "SESSION_UNAVAILABLE");
  }

  await db
    .update(schema.gameSessions)
    .set({ status: "OPEN", expiresAt: "2026-01-01T00:30:00.000Z" })
    .where(eq(schema.gameSessions.id, session.sessionId));
  const expiredClock = fixedClock("2026-01-01T01:00:00.000Z");
  const expired = await handleSpin(
    db,
    makeAuth("p1"),
    makeServices(wallet, { clock: expiredClock }),
    {
      sessionId: session.sessionId,
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "expired-spin",
    },
  );
  assert.equal(expired.status, 403);
  assert.equal((await parseJson(expired)).error.code, "SESSION_UNAVAILABLE");
});

test("player currency mismatch with session snapshot is rejected", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1", "USD");
  const session = await openSession(db, "p1");
  await db
    .update(schema.players)
    .set({ currency: "THB" })
    .where(eq(schema.players.id, "p1"));
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "THB", 10_000);

  const response = await handleSpin(db, makeAuth("p1"), makeServices(wallet), {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "currency-mismatch",
  });
  assert.equal(response.status, 409);
  assert.equal((await parseJson(response)).error.code, "SESSION_CURRENCY_MISMATCH");
});

test("client forged free-game fields are rejected", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1");
  const session = await openSession(db, "p1");
  const response = await handleSpin(db, makeAuth("p1"), makeServices(), {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "forge-free",
    isFreeGame: true,
    freeGamesRemainingBefore: 99,
  });
  assert.equal(response.status, 400);
  assert.equal((await parseJson(response)).error.code, "INVALID_REQUEST");
});

test("server free games are consumed and awards are credited", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1");
  const session = await openSession(db, "p1");
  await db
    .update(schema.gameSessions)
    .set({ freeGamesRemaining: 2 })
    .where(eq(schema.gameSessions.id, session.sessionId));

  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const before = await wallet.getAvailableBalance("p1", "USD");

  const response = await handleSpin(
    db,
    makeAuth("p1"),
    makeServices(wallet, { testFixedGrid: scatterGrid }),
    {
      sessionId: session.sessionId,
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "free-award",
    },
  );
  assert.equal(response.status, 200);
  const body = await parseJson(response);
  assert.equal(body.isFreeGame, true);
  assert.equal(body.awardedFreeGames, 8);
  assert.equal(body.freeGamesRemaining, 2 - 1 + 8);
  // Free games do not debit stake; payouts may still credit the wallet.
  assert.equal(await wallet.getAvailableBalance("p1", "USD"), before + body.totalWinMinor);

  const row = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  assert.equal(row.freeGamesRemaining, 9);
});

test("two concurrent spins cannot consume the same free game", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1");
  const session = await openSession(db, "p1");
  await db
    .update(schema.gameSessions)
    .set({ freeGamesRemaining: 1 })
    .where(eq(schema.gameSessions.id, session.sessionId));

  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);

  const [a, b] = await Promise.all([
    handleSpin(db, makeAuth("p1"), makeServices(wallet), {
      sessionId: session.sessionId,
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "concurrent-free-a",
    }),
    handleSpin(db, makeAuth("p1"), makeServices(wallet), {
      sessionId: session.sessionId,
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "concurrent-free-b",
    }),
  ]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  const bodies = [await parseJson(a), await parseJson(b)];
  const freeBody = bodies.find((body) => body.isFreeGame);
  const paidBody = bodies.find((body) => !body.isFreeGame);
  assert.ok(freeBody);
  assert.ok(paidBody);

  const row = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  assert.equal(row.freeGamesRemaining, 0);
  const expected =
    10_000 - paidBody.totalBetMinor + freeBody.totalWinMinor + paidBody.totalWinMinor;
  assert.equal(await wallet.getAvailableBalance("p1", "USD"), expected);
});

test("same idempotency key and request returns identical result once", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1");
  const session = await openSession(db, "p1");
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const payload = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "same-request",
  };
  const first = await parseJson(await handleSpin(db, makeAuth("p1"), makeServices(wallet), payload));
  const balanceAfterFirst = await wallet.getAvailableBalance("p1", "USD");
  const second = await parseJson(await handleSpin(db, makeAuth("p1"), makeServices(wallet), payload));
  assert.deepEqual(first, second);
  assert.equal(await wallet.getAvailableBalance("p1", "USD"), balanceAfterFirst);
});

test("same idempotency key with different bet params returns 409 IDEMPOTENCY_CONFLICT", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1");
  const session = await openSession(db, "p1");
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);

  const first = await handleSpin(db, makeAuth("p1"), makeServices(wallet), {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "conflict-key",
  });
  assert.equal(first.status, 200);

  const second = await handleSpin(db, makeAuth("p1"), makeServices(wallet), {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 2,
    betMultiplier: 1,
    idempotencyKey: "conflict-key",
  });
  assert.equal(second.status, 409);
  assert.equal((await parseJson(second)).error.code, "IDEMPOTENCY_CONFLICT");
});

test("failed spin does not swallow a free game", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1");
  const session = await openSession(db, "p1");
  await db
    .update(schema.gameSessions)
    .set({ freeGamesRemaining: 1 })
    .where(eq(schema.gameSessions.id, session.sessionId));

  const response = await handleSpin(db, makeAuth("p1"), makeServices(), {
    sessionId: session.sessionId,
    roomBase: 999,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "fail-free",
  });
  assert.equal(response.status, 400);
  assert.equal((await parseJson(response)).error.code, "VALIDATION_ERROR");

  const row = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  assert.equal(row.freeGamesRemaining, 1);
});

test("request_payload stores only canonical whitelisted spin fields", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1");
  const session = await openSession(db, "p1");
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);

  const response = await handleSpin(db, makeAuth("p1"), makeServices(wallet), {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "payload-check",
  });
  assert.equal(response.status, 200);
  const body = await parseJson(response);
  const row = await db.query.gameRounds.findFirst({
    where: eq(schema.gameRounds.id, body.roundId),
  });
  const stored = JSON.parse(row.requestPayload);
  assert.deepEqual(stored, {
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "payload-check",
    roomBase: 50,
    sessionId: session.sessionId,
  });
  for (const forbidden of [
    "playerId",
    "currency",
    "isFreeGame",
    "freeGamesRemainingBefore",
    "grid",
    "winscore",
    "mathVersionId",
  ]) {
    assert.equal(Object.hasOwn(stored, forbidden), false);
  }
});

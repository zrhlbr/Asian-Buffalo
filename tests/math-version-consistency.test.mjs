/**
 * R1-M3-PRE: Session / Round / executable math version binding gates.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { handleCreateSession, handleSpin } from "../lib/api-handlers.ts";
import { INITIAL_MATH_VERSION } from "../lib/math-config.ts";
import { TestRoundStore } from "../lib/round-store.ts";
import { TestWalletAdapter } from "../lib/wallet-adapter.ts";
import { LEASE_TTL_MS } from "../lib/spin-orchestrator.ts";
import { createTestDb } from "./db-helper.mjs";
import { TestIdentityProvider } from "./helpers/test-identity-provider.mjs";
import { loadExecutableMathVersion } from "./helpers/frozen-math-version.mjs";
import { testExecutableMath } from "./helpers/test-executable-math.mjs";
import * as schema from "../db/schema.ts";

const otherExecutableMath = await loadExecutableMathVersion({
  version: "ab-math-other-frozen-1.0.0",
});

function makeAuth(playerId = "p1") {
  return {
    identityProvider: new TestIdentityProvider(playerId),
    request: new Request("http://localhost/v1/game/test"),
  };
}

function countingWallet() {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  let settleCalls = 0;
  const original = wallet.settleRound.bind(wallet);
  wallet.settleRound = async (input) => {
    settleCalls += 1;
    return original(input);
  };
  return {
    wallet,
    settleCalls: () => settleCalls,
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

async function openSession(db, playerId = "p1", clock) {
  const response = await handleCreateSession(db, makeAuth(playerId), {}, clock);
  assert.equal(response.status, 200);
  return response.json();
}

const deadGrid = [
  ["nine", "ten", "j", "q"],
  ["ten", "j", "q", "k"],
  ["j", "q", "k", "a"],
  ["q", "k", "a", "nine"],
  ["k", "a", "nine", "ten"],
];

test("matching session and executable versions execute normally", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const session = await openSession(db);
  assert.equal(session.mathVersionId, INITIAL_MATH_VERSION.version);
  assert.equal(session.mathVersionId, testExecutableMath.version);

  const { wallet, settleCalls } = countingWallet();
  const response = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, { mathConfig: testExecutableMath }),
    {
      sessionId: session.sessionId,
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "match-ok",
    },
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mathVersion, testExecutableMath.version);
  assert.equal(settleCalls(), 1);

  const round = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, "p1"),
      eq(schema.gameRounds.idempotencyKey, "match-ok"),
    ),
  });
  assert.ok(round);
  assert.equal(round.mathVersionId, testExecutableMath.version);
  assert.equal(round.status, "SETTLED");
});

test("session version mismatch rejects before claim and does not call wallet", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const session = await openSession(db);
  assert.equal(session.mathVersionId, "ab-math-1.0.0");
  assert.notEqual(session.mathVersionId, otherExecutableMath.version);

  const { wallet, settleCalls } = countingWallet();
  const response = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, { mathConfig: otherExecutableMath }),
    {
      sessionId: session.sessionId,
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "session-mismatch",
    },
  );
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.error.code, "MATH_VERSION_MISMATCH");
  assert.match(body.error.message, /math version mismatch/);
  assert.notEqual(body.error.code, "INSUFFICIENT_BALANCE");
  assert.notEqual(body.error.code, "VALIDATION_ERROR");
  assert.equal(settleCalls(), 0);

  const round = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, "p1"),
      eq(schema.gameRounds.idempotencyKey, "session-mismatch"),
    ),
  });
  assert.equal(round, undefined);

  const sessionAfter = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, session.sessionId),
  });
  assert.equal(sessionAfter.mathVersionId, "ab-math-1.0.0");
});

test("DRAFT session must not execute with a different FROZEN executable", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  assert.equal(INITIAL_MATH_VERSION.status, "DRAFT");

  // Persist a distinct DRAFT row and point a session at it (bypass selectMathVersion).
  const draftId = "ab-math-draft-only";
  const draft = {
    ...INITIAL_MATH_VERSION,
    version: draftId,
    status: "DRAFT",
  };
  const { hashMathVersionConfig } = await import("../lib/math-config.ts");
  await db.insert(schema.gameMathVersions).values({
    id: draftId,
    sha256: await hashMathVersionConfig(draft),
    status: "DRAFT",
    configJson: JSON.stringify(draft),
    activatedAt: null,
  });
  await db.insert(schema.gameSessions).values({
    id: "sess_draft_only",
    playerId: "p1",
    mathVersionId: draftId,
    status: "OPEN",
    currency: "USD",
    freeGamesRemaining: 0,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });

  assert.equal(otherExecutableMath.status, "FROZEN");
  assert.notEqual(otherExecutableMath.version, draftId);

  const { wallet, settleCalls } = countingWallet();
  const response = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, { mathConfig: otherExecutableMath }),
    {
      sessionId: "sess_draft_only",
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "draft-vs-other-frozen",
    },
  );
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.error.code, "MATH_VERSION_MISMATCH");
  assert.equal(settleCalls(), 0);
});

test("round version mismatch rejects recovery and does not call wallet", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const t0 = "2026-10-01T00:00:00.000Z";
  const session = await openSession(db, "p1", fixedClock(t0));
  const { wallet, settleCalls } = countingWallet();

  // Create a PENDING round under the matching executable, then crash before wallet.
  const stuck = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      mathConfig: testExecutableMath,
      clock: fixedClock(t0),
      testFixedGrid: deadGrid,
      faults: {
        afterOutcomePersist: () => {
          throw new Error("stall before wallet");
        },
      },
    }),
    {
      sessionId: session.sessionId,
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "round-mismatch-recovery",
    },
  );
  assert.equal(stuck.status, 500);
  assert.equal(settleCalls(), 0);

  const pending = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, "p1"),
      eq(schema.gameRounds.idempotencyKey, "round-mismatch-recovery"),
    ),
  });
  assert.ok(pending);
  assert.equal(pending.status, "PENDING");
  assert.equal(pending.mathVersionId, testExecutableMath.version);
  assert.notEqual(pending.mathVersionId, otherExecutableMath.version);

  // Resume with a drifted executable — must fail closed before wallet.
  const recovered = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      mathConfig: otherExecutableMath,
      testFixedGrid: deadGrid,
      clock: fixedClock(new Date(Date.parse(t0) + LEASE_TTL_MS + 1_000).toISOString()),
    }),
    {
      sessionId: session.sessionId,
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "round-mismatch-recovery",
    },
  );
  assert.equal(recovered.status, 500);
  const body = await recovered.json();
  assert.equal(body.error.code, "MATH_VERSION_MISMATCH");
  assert.equal(settleCalls(), 0);

  const after = await db.query.gameRounds.findFirst({
    where: eq(schema.gameRounds.id, pending.id),
  });
  assert.equal(after.status, "PENDING");
  assert.equal(after.mathVersionId, testExecutableMath.version);
  assert.equal(after.walletApplied, false);
});

test("crash recovery still fail-closes when executable drifts from round", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const t0 = "2026-11-01T00:00:00.000Z";
  const session = await openSession(db, "p1", fixedClock(t0));
  const { wallet, settleCalls } = countingWallet();

  const stuck = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      mathConfig: testExecutableMath,
      clock: fixedClock(t0),
      testFixedGrid: deadGrid,
      faults: {
        afterOutcomePersist: () => {
          throw new Error("worker crash after outcome");
        },
      },
    }),
    {
      sessionId: session.sessionId,
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "crash-drift",
    },
  );
  assert.equal(stuck.status, 500);

  const pending = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, "p1"),
      eq(schema.gameRounds.idempotencyKey, "crash-drift"),
    ),
  });
  assert.ok(pending);
  assert.ok(pending.outcomeJson);

  const drifted = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      mathConfig: otherExecutableMath,
      clock: fixedClock(new Date(Date.parse(t0) + LEASE_TTL_MS + 5_000).toISOString()),
    }),
    {
      sessionId: session.sessionId,
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "crash-drift",
    },
  );
  assert.equal(drifted.status, 500);
  const body = await drifted.json();
  assert.equal(body.error.code, "MATH_VERSION_MISMATCH");
  assert.equal(settleCalls(), 0);

  const finalRound = await db.query.gameRounds.findFirst({
    where: eq(schema.gameRounds.id, pending.id),
  });
  assert.equal(finalRound.status, "PENDING");
  assert.equal(finalRound.mathVersionId, pending.mathVersionId);
  assert.equal(finalRound.walletApplied, false);
});

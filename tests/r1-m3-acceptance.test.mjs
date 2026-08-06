/**
 * Formal R1-M3 acceptance: selectMathVersion wiring, DB FROZEN persistence,
 * and Session/Round/Recovery executable math unification.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import {
  handleCreateSession,
  handleGetRules,
  handleSpin,
} from "../lib/api-handlers.ts";
import {
  listMathVersionRows,
  loadExecutableMathVersionById,
  seedProductionFrozenMathVersion,
} from "../lib/db-game.ts";
import { INITIAL_MATH_VERSION, PRODUCTION_FROZEN_MATH_VERSION } from "../lib/math-config.ts";
import {
  MathVersionUnavailableError,
  selectMathVersion,
} from "../lib/math-version-loader.ts";
import { TestRoundStore } from "../lib/round-store.ts";
import { TestWalletAdapter } from "../lib/wallet-adapter.ts";
import { LEASE_TTL_MS } from "../lib/spin-orchestrator.ts";
import { createTestDb } from "./db-helper.mjs";
import { TestIdentityProvider } from "./helpers/test-identity-provider.mjs";
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
    // Intentionally omit mathConfig so production DB-load path is exercised.
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

const deadGrid = [
  ["nine", "ten", "j", "q"],
  ["ten", "j", "q", "k"],
  ["j", "q", "k", "a"],
  ["q", "k", "a", "nine"],
  ["k", "a", "nine", "ten"],
];

test("seedProductionFrozenMathVersion persists executable FROZEN row", async () => {
  const { db } = createTestDb();
  const loaded = await seedProductionFrozenMathVersion(db);
  assert.equal(loaded.status, "FROZEN");
  assert.equal(loaded.version, PRODUCTION_FROZEN_MATH_VERSION.version);
  assert.equal(loaded.disclosure.status, "FROZEN");
  assert.equal(loaded.disclosure.realMoneyEnabled, false);

  const row = await db.query.gameMathVersions.findFirst({
    where: eq(schema.gameMathVersions.id, loaded.version),
  });
  assert.ok(row);
  assert.equal(row.status, "FROZEN");
  assert.ok(row.activatedAt);

  // DRAFT prototype must not be what selectMathVersion returns.
  assert.equal(INITIAL_MATH_VERSION.status, "DRAFT");
  const selected = await selectMathVersion(await listMathVersionRows(db));
  assert.equal(selected.version, loaded.version);
  assert.equal(selected.status, "FROZEN");
});

test("selectMathVersion ignores DRAFT rows and fail-closes when none are FROZEN", async () => {
  const { db } = createTestDb();
  await db.insert(schema.gameMathVersions).values({
    id: "draft-only",
    sha256: "a".repeat(64),
    status: "DRAFT",
    configJson: JSON.stringify({ ...INITIAL_MATH_VERSION, version: "draft-only" }),
    activatedAt: null,
  });
  await assert.rejects(
    selectMathVersion(await listMathVersionRows(db)),
    MathVersionUnavailableError,
  );
});

test("createSession wires selectMathVersion into session.math_version_id", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const response = await handleCreateSession(db, makeAuth(), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mathVersionId, PRODUCTION_FROZEN_MATH_VERSION.version);

  const session = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, body.sessionId),
  });
  assert.equal(session.mathVersionId, body.mathVersionId);

  const mathRow = await db.query.gameMathVersions.findFirst({
    where: eq(schema.gameMathVersions.id, session.mathVersionId),
  });
  assert.equal(mathRow.status, "FROZEN");
});

test("spin without injected mathConfig loads ExecutableMathVersion from session", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const sessionRes = await handleCreateSession(db, makeAuth(), {});
  const session = await sessionRes.json();

  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const response = await handleSpin(db, makeAuth(), makeServices(wallet), {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "m3-db-load",
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mathVersion, session.mathVersionId);

  const round = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, "p1"),
      eq(schema.gameRounds.idempotencyKey, "m3-db-load"),
    ),
  });
  assert.ok(round);
  assert.equal(round.mathVersionId, session.mathVersionId);
  assert.equal(round.mathVersionId, body.mathVersion);
  assert.equal(round.status, "SETTLED");
});

test("session / round / recovery share one executable math version", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const t0 = "2026-12-01T00:00:00.000Z";
  const sessionRes = await handleCreateSession(db, makeAuth(), {}, fixedClock(t0));
  const session = await sessionRes.json();

  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);

  const stuck = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      clock: fixedClock(t0),
      testFixedGrid: deadGrid,
      faults: {
        afterOutcomePersist: () => {
          throw new Error("crash before wallet");
        },
      },
    }),
    {
      sessionId: session.sessionId,
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "m3-recovery-unify",
    },
  );
  assert.equal(stuck.status, 500);

  const pending = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, "p1"),
      eq(schema.gameRounds.idempotencyKey, "m3-recovery-unify"),
    ),
  });
  assert.ok(pending);
  assert.equal(pending.mathVersionId, session.mathVersionId);
  assert.equal(pending.status, "PENDING");

  const recovered = await handleSpin(
    db,
    makeAuth(),
    makeServices(wallet, {
      testFixedGrid: deadGrid,
      clock: fixedClock(new Date(Date.parse(t0) + LEASE_TTL_MS + 1_000).toISOString()),
    }),
    {
      sessionId: session.sessionId,
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "m3-recovery-unify",
    },
  );
  assert.equal(recovered.status, 200);
  const body = await recovered.json();
  assert.equal(body.mathVersion, session.mathVersionId);
  assert.equal(body.mathVersion, pending.mathVersionId);

  const settled = await db.query.gameRounds.findFirst({
    where: eq(schema.gameRounds.id, pending.id),
  });
  assert.equal(settled.status, "SETTLED");
  assert.equal(settled.mathVersionId, session.mathVersionId);
});

test("rules endpoint serves loader-validated FROZEN config from DB", async () => {
  const { db } = createTestDb();
  await seedProductionFrozenMathVersion(db);
  const response = await handleGetRules(db, PRODUCTION_FROZEN_MATH_VERSION.version);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.version, PRODUCTION_FROZEN_MATH_VERSION.version);
  assert.equal(body.status, "FROZEN");
  assert.equal(body.disclosure.realMoneyEnabled, false);
});

test("loadExecutableMathVersionById rejects unknown ids", async () => {
  const { db } = createTestDb();
  await seedProductionFrozenMathVersion(db);
  await assert.rejects(
    loadExecutableMathVersionById(db, "missing-version"),
    MathVersionUnavailableError,
  );
});

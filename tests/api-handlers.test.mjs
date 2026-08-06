import assert from "node:assert/strict";
import test from "node:test";
import {
  handleCreateSession,
  handleGetRound,
  handleGetRules,
  handleSpin,
} from "../lib/api-handlers.ts";
import { TestRoundStore } from "../lib/round-store.ts";
import { TestWalletAdapter } from "../lib/wallet-adapter.ts";
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

function makeServices(wallet = new TestWalletAdapter(), roundStore = new TestRoundStore()) {
  return {
    walletAdapter: wallet,
    roundStore,
    allowRealMoney: false,
    mathConfig: testExecutableMath,
  };
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

async function createOpenSession(db, playerId = "p1") {
  const response = await handleCreateSession(db, makeAuth(playerId), {});
  assert.equal(response.status, 200);
  return parseJson(response);
}

test("create session returns a session id for empty body", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const response = await handleCreateSession(db, makeAuth(), {});
  assert.equal(response.status, 200);
  const body = await parseJson(response);
  assert.ok(body.sessionId.startsWith("sess_"));
  assert.equal(body.mathVersionId, "ab-math-1.0.0");
  assert.ok(body.expiresAt);
});

test("create session rejects non-empty body", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const response = await handleCreateSession(db, makeAuth(), {
    mathVersionId: "ab-math-1.0.0",
  });
  assert.equal(response.status, 400);
  const body = await parseJson(response);
  assert.equal(body.error.code, "INVALID_REQUEST");
});

test("create session fails when authenticated player has no DB currency row", async () => {
  const { db } = createTestDb();
  const response = await handleCreateSession(db, makeAuth("missing-player"), {});
  assert.equal(response.status, 404);
  const body = await parseJson(response);
  assert.equal(body.error.code, "PLAYER_NOT_FOUND");
});

test("spin endpoint processes a valid bet using session currency", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1", "USD");
  const session = await createOpenSession(db);
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const response = await handleSpin(db, makeAuth(), makeServices(wallet), {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "spin-1",
  });
  assert.equal(response.status, 200);
  const body = await parseJson(response);
  assert.equal(body.playerId, "p1");
  assert.equal(body.currency, "USD");
  assert.equal(body.totalBetMinor, 50);
  assert.equal(body.mathVersion, "ab-math-1.0.0");
  assert.ok(body.grid);
});

test("spin endpoint rejects client outcome fields via schema", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1", "USD");
  const session = await createOpenSession(db);
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const response = await handleSpin(db, makeAuth(), makeServices(wallet), {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "spin-1",
    grid: [["buffalo"]],
    winscore: 1000,
  });
  assert.equal(response.status, 400);
  const body = await parseJson(response);
  assert.equal(body.error.code, "INVALID_REQUEST");
});

test("spin endpoint rejects invalid bet configuration", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1", "USD");
  const session = await createOpenSession(db);
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const response = await handleSpin(db, makeAuth(), makeServices(wallet), {
    sessionId: session.sessionId,
    roomBase: 999,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "spin-1",
  });
  assert.equal(response.status, 400);
  const body = await parseJson(response);
  assert.equal(body.error.code, "VALIDATION_ERROR");
});

test("spin endpoint returns existing round on idempotency key reuse", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1", "USD");
  const session = await createOpenSession(db);
  const wallet = new TestWalletAdapter();
  const roundStore = new TestRoundStore();
  wallet.creditAvailable("p1", "USD", 10_000);
  const payload = {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "idem-1",
  };
  const first = await handleSpin(db, makeAuth(), makeServices(wallet, roundStore), payload);
  const balanceAfterFirst = await wallet.getAvailableBalance("p1", "USD");
  const second = await handleSpin(db, makeAuth(), makeServices(wallet, roundStore), payload);
  const firstBody = await parseJson(first);
  const secondBody = await parseJson(second);
  assert.deepEqual(firstBody, secondBody);
  assert.equal(await wallet.getAvailableBalance("p1", "USD"), balanceAfterFirst);
});

test("spin endpoint rejects insufficient balance", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1", "USD");
  const session = await createOpenSession(db);
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10);
  const response = await handleSpin(db, makeAuth(), makeServices(wallet), {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "spin-1",
  });
  assert.equal(response.status, 400);
  const body = await parseJson(response);
  assert.equal(body.error.code, "INSUFFICIENT_BALANCE");
});

test("get round returns saved round for owning player", async () => {
  const { db } = createTestDb();
  await seedPlayer(db, "p1", "USD");
  const session = await createOpenSession(db);
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "USD", 10_000);
  const spinResponse = await handleSpin(db, makeAuth(), makeServices(wallet), {
    sessionId: session.sessionId,
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "round-get",
  });
  const spinBody = await parseJson(spinResponse);
  const getResponse = await handleGetRound(db, makeAuth(), spinBody.roundId);
  assert.equal(getResponse.status, 200);
  const getBody = await parseJson(getResponse);
  assert.equal(getBody.roundId, spinBody.roundId);
});

test("get round returns 404 for unknown round", async () => {
  const { db } = createTestDb();
  await seedPlayer(db);
  const response = await handleGetRound(db, makeAuth(), "nonexistent");
  assert.equal(response.status, 404);
  const body = await parseJson(response);
  assert.equal(body.error.code, "ROUND_NOT_FOUND");
});

test("get rules returns math config", async () => {
  const { db } = createTestDb();
  const response = await handleGetRules(db, "ab-math-1.0.0");
  assert.equal(response.status, 200);
  const body = await parseJson(response);
  assert.equal(body.version, "ab-math-1.0.0");
  assert.equal(body.status, "DRAFT");
});

test("get rules returns 404 for unknown version", async () => {
  const { db } = createTestDb();
  const response = await handleGetRules(db, "unknown");
  assert.equal(response.status, 400);
  const body = await parseJson(response);
  assert.equal(body.error.code, "RULES_NOT_FOUND");
});

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

function makeServices(wallet = new TestWalletAdapter(), roundStore = new TestRoundStore()) {
  return {
    walletAdapter: wallet,
    roundStore,
    allowRealMoney: false,
  };
}

async function parseJson(response) {
  return response.json();
}

test("create session returns a session id", async () => {
  const { db } = createTestDb();
  const response = await handleCreateSession(db, {
    playerId: "p1",
    currency: "MMK",
    mathVersionId: "ab-math-1.0.0",
  });
  assert.equal(response.status, 200);
  const body = await parseJson(response);
  assert.ok(body.sessionId.startsWith("sess_"));
  assert.equal(body.mathVersionId, "ab-math-1.0.0");
  assert.ok(body.expiresAt);
});

test("create session rejects invalid input", async () => {
  const { db } = createTestDb();
  const response = await handleCreateSession(db, {
    playerId: "",
    currency: "MMK",
    mathVersionId: "ab-math-1.0.0",
  });
  assert.equal(response.status, 400);
  const body = await parseJson(response);
  assert.equal(body.error.code, "INVALID_REQUEST");
});

test("create session rejects unknown math version", async () => {
  const { db } = createTestDb();
  const response = await handleCreateSession(db, {
    playerId: "p1",
    currency: "MMK",
    mathVersionId: "unknown",
  });
  assert.equal(response.status, 400);
  const body = await parseJson(response);
  assert.equal(body.error.code, "INVALID_REQUEST");
});

test("spin endpoint processes a valid bet", async () => {
  const { db } = createTestDb();
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  const response = await handleSpin(
    db,
    makeServices(wallet),
    {
      sessionId: "sess_1",
      playerId: "p1",
      currency: "MMK",
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "spin-1",
      isFreeGame: false,
      freeGamesRemainingBefore: 0,
    },
  );
  assert.equal(response.status, 200);
  const body = await parseJson(response);
  assert.equal(body.playerId, "p1");
  assert.equal(body.totalBetMinor, 50);
  assert.equal(body.mathVersion, "ab-math-1.0.0");
  assert.ok(body.grid);
});

test("spin endpoint rejects client outcome fields", async () => {
  const { db } = createTestDb();
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  const response = await handleSpin(
    db,
    makeServices(wallet),
    {
      sessionId: "sess_1",
      playerId: "p1",
      currency: "MMK",
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "spin-1",
      isFreeGame: false,
      freeGamesRemainingBefore: 0,
      grid: [["buffalo"]],
      winscore: 1000,
    },
  );
  assert.equal(response.status, 400);
  const body = await parseJson(response);
  assert.equal(body.error.code, "CLIENT_OUTCOME_REJECTED");
});

test("spin endpoint rejects invalid bet configuration", async () => {
  const { db } = createTestDb();
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  const response = await handleSpin(
    db,
    makeServices(wallet),
    {
      sessionId: "sess_1",
      playerId: "p1",
      currency: "MMK",
      roomBase: 999,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "spin-1",
      isFreeGame: false,
      freeGamesRemainingBefore: 0,
    },
  );
  assert.equal(response.status, 400);
  const body = await parseJson(response);
  assert.equal(body.error.code, "VALIDATION_ERROR");
});

test("spin endpoint returns existing round on idempotency key reuse", async () => {
  const { db } = createTestDb();
  const wallet = new TestWalletAdapter();
  const roundStore = new TestRoundStore();
  wallet.creditAvailable("p1", "MMK", 10_000);
  const payload = {
    sessionId: "sess_1",
    playerId: "p1",
    currency: "MMK",
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "idem-1",
    isFreeGame: false,
    freeGamesRemainingBefore: 0,
  };
  const first = await handleSpin(db, makeServices(wallet, roundStore), payload);
  const second = await handleSpin(db, makeServices(wallet, roundStore), payload);
  const firstBody = await parseJson(first);
  const secondBody = await parseJson(second);
  assert.deepEqual(firstBody, secondBody);
});

test("spin endpoint rejects insufficient balance", async () => {
  const { db } = createTestDb();
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10);
  const response = await handleSpin(
    db,
    makeServices(wallet),
    {
      sessionId: "sess_1",
      playerId: "p1",
      currency: "MMK",
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: "spin-1",
      isFreeGame: false,
      freeGamesRemainingBefore: 0,
    },
  );
  assert.equal(response.status, 400);
  const body = await parseJson(response);
  assert.equal(body.error.code, "INSUFFICIENT_BALANCE");
});

test("get round returns saved round", async () => {
  const { db } = createTestDb();
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  const payload = {
    sessionId: "sess_1",
    playerId: "p1",
    currency: "MMK",
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: "round-get",
    isFreeGame: false,
    freeGamesRemainingBefore: 0,
  };
  const spinResponse = await handleSpin(db, makeServices(wallet), payload);
  const spinBody = await parseJson(spinResponse);
  const getResponse = await handleGetRound(db, spinBody.roundId);
  assert.equal(getResponse.status, 200);
  const getBody = await parseJson(getResponse);
  assert.equal(getBody.roundId, spinBody.roundId);
});

test("get round returns 404 for unknown round", async () => {
  const { db } = createTestDb();
  const response = await handleGetRound(db, "nonexistent");
  assert.equal(response.status, 400);
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

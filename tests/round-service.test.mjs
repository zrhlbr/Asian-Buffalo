import assert from "node:assert/strict";
import test from "node:test";
import { INITIAL_MATH_VERSION } from "../lib/math-config.ts";
import { processSpin, RoundValidationError } from "../lib/round-service.ts";
import { TestRoundStore } from "../lib/round-store.ts";
import { TestWalletAdapter } from "../lib/wallet-adapter.ts";

function makeService(wallet, roundStore = new TestRoundStore()) {
  return {
    walletAdapter: wallet,
    roundStore,
    mathConfig: INITIAL_MATH_VERSION,
    allowRealMoney: false,
  };
}

function spinRequest(overrides = {}) {
  return {
    sessionId: "session-1",
    playerId: "p1",
    currency: "MMK",
    roomBase: 50,
    betLevel: 1,
    betMultiplier: 1,
    idempotencyKey: `key-${Date.now()}-${Math.random()}`,
    isFreeGame: false,
    freeGamesRemainingBefore: 0,
    ...overrides,
  };
}

test("processes a base-game spin and updates balance", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  const result = await processSpin(makeService(wallet), spinRequest());
  assert.equal(result.totalBetMinor, 50);
  assert.equal(result.playerId, "p1");
  assert.equal(result.mathVersion, INITIAL_MATH_VERSION.version);
  assert.equal(result.balanceAfterMinor, 9_950 + result.totalWinMinor);
  assert.equal(result.isFreeGame, false);
});

test("free-game spin does not debit stake", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  const result = await processSpin(
    makeService(wallet),
    spinRequest({
      isFreeGame: true,
      freeGamesRemainingBefore: 5,
      roomBase: 50,
      betLevel: 10,
      betMultiplier: 50,
      fixedGrid: [
        ["buffalo", "a", "k", "q"],
        ["buffalo", "nine", "nine", "nine"],
        ["buffalo", "nine", "nine", "nine"],
        ["buffalo", "nine", "nine", "nine"],
        ["buffalo", "nine", "nine", "nine"],
      ],
    }),
  );
  // Free games retain the triggering bet value for line/scatter evaluation
  // but charge zero stake.
  assert.equal(result.totalBetMinor, 50 * 10 * 50);
  assert.ok(result.totalWinMinor > 0);
  assert.equal(result.isFreeGame, true);
  assert.equal(result.freeGamesRemaining, 4);
  const balance = await wallet.getAvailableBalance("p1", "MMK");
  assert.equal(balance, 10_000 + result.totalWinMinor);
});

test("rejects client-submitted outcome fields", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  await assert.rejects(
    processSpin(
      makeService(wallet),
      spinRequest(),
      { grid: [["buffalo"]], winscore: 1000 },
    ),
    RoundValidationError,
  );
  await assert.rejects(
    processSpin(
      makeService(wallet),
      spinRequest(),
      { multiplier: 3, freeGames: 10 },
    ),
    RoundValidationError,
  );
});

test("rejects invalid bet configuration", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  await assert.rejects(
    processSpin(makeService(wallet), spinRequest({ roomBase: 123 })),
    RoundValidationError,
  );
  await assert.rejects(
    processSpin(makeService(wallet), spinRequest({ betLevel: 11 })),
    RoundValidationError,
  );
  await assert.rejects(
    processSpin(makeService(wallet), spinRequest({ betMultiplier: 7 })),
    RoundValidationError,
  );
});

test("rejects base-game spin with zero bet", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  await assert.rejects(
    processSpin(makeService(wallet), spinRequest({ betMultiplier: 0 })),
    RoundValidationError,
  );
});

test("idempotent spin returns same result", async () => {
  const wallet = new TestWalletAdapter();
  const roundStore = new TestRoundStore();
  wallet.creditAvailable("p1", "MMK", 10_000);
  const request = spinRequest({ idempotencyKey: "idem-1" });
  const first = await processSpin(makeService(wallet, roundStore), request);
  const second = await processSpin(makeService(wallet, roundStore), request);
  assert.deepEqual(first, second);
  const balance = await wallet.getAvailableBalance("p1", "MMK");
  assert.equal(balance, 10_000 - first.totalBetMinor + first.totalWinMinor);
});

test("insufficient balance is rejected before outcome generation", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10);
  await assert.rejects(
    processSpin(makeService(wallet), spinRequest()),
    /balance/i,
  );
});

test("allowRealMoney=true blocks DRAFT math version", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  await assert.rejects(
    processSpin(
      {
        walletAdapter: wallet,
        roundStore: new TestRoundStore(),
        mathConfig: INITIAL_MATH_VERSION,
        allowRealMoney: true,
      },
      spinRequest(),
    ),
    /RealMoneyBlockedError|Real-money settlement blocked/i,
  );
});

test("scatter trigger records awarded free games", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  const result = await processSpin(
    makeService(wallet),
    spinRequest({
      fixedGrid: [
        ["scatter", "lion", "ten", "buffalo"],
        ["scatter", "wild", "q", "elephant"],
        ["nine", "antelope", "scatter", "k"],
        ["elephant", "j", "wild", "lion"],
        ["buffalo", "ten", "zebra", "a"],
      ],
    }),
  );
  assert.equal(result.scatterCount, 3);
  assert.equal(result.awardedFreeGames, 8);
  assert.equal(result.scatterWin, 2 * result.totalBetMinor);
});

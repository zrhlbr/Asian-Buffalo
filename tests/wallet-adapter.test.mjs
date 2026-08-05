import assert from "node:assert/strict";
import test from "node:test";
import {
  InsufficientBalanceError,
  TestWalletAdapter,
} from "../lib/wallet-adapter.ts";

test("test wallet adapter creates accounts on demand", async () => {
  const wallet = new TestWalletAdapter();
  const accounts = await wallet.ensurePlayerAccounts("p1", "MMK");
  assert.equal(accounts.available.kind, "PLAYER_AVAILABLE");
  assert.equal(accounts.clearing.kind, "GAME_CLEARING");
  assert.equal(accounts.available.balanceMinor, 0);
});

test("credits and reads available balance", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  const balance = await wallet.getAvailableBalance("p1", "MMK");
  assert.equal(balance, 10_000);
});

test("settling a bet debits available and credits clearing", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  const settlement = await wallet.settleRound({
    idempotencyKey: "spin-1",
    playerId: "p1",
    currency: "MMK",
    betMinor: 500,
    winMinor: 0,
    isFreeGame: false,
  });
  assert.equal(settlement.betMinor, 500);
  assert.equal(settlement.winMinor, 0);
  assert.equal(settlement.playerBalanceAfterMinor, 9_500);
  assert.equal(settlement.postings.length, 2);
  assert.equal(settlement.postings.reduce((sum, p) => sum + p.amountMinor, 0), 0);

  const accounts = await wallet.ensurePlayerAccounts("p1", "MMK");
  assert.equal(accounts.available.balanceMinor, 9_500);
  assert.equal(accounts.clearing.balanceMinor, 500);
});

test("settling with a win moves payout from clearing to available", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  const settlement = await wallet.settleRound({
    idempotencyKey: "spin-1",
    playerId: "p1",
    currency: "MMK",
    betMinor: 500,
    winMinor: 1_200,
    isFreeGame: false,
  });
  assert.equal(settlement.playerBalanceAfterMinor, 10_700);
  assert.equal(settlement.postings.length, 4);
  assert.equal(settlement.postings.reduce((sum, p) => sum + p.amountMinor, 0), 0);
});

test("free game has betMinor = 0 and only payout postings", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  const settlement = await wallet.settleRound({
    idempotencyKey: "free-1",
    playerId: "p1",
    currency: "MMK",
    betMinor: 0,
    winMinor: 1_500,
    isFreeGame: true,
  });
  assert.equal(settlement.betMinor, 0);
  assert.equal(settlement.postings.length, 2);
  assert.equal(settlement.postings.every((p) => p.memo === "PAYOUT"), true);
});

test("rejects free game with non-zero bet", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  await assert.rejects(
    wallet.settleRound({
      idempotencyKey: "bad-free",
      playerId: "p1",
      currency: "MMK",
      betMinor: 500,
      winMinor: 0,
      isFreeGame: true,
    }),
    /free-game round/i,
  );
});

test("rejects bet exceeding balance", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 100);
  await assert.rejects(
    wallet.settleRound({
      idempotencyKey: "overdraft",
      playerId: "p1",
      currency: "MMK",
      betMinor: 500,
      winMinor: 0,
      isFreeGame: false,
    }),
    InsufficientBalanceError,
  );
});

test("idempotent settlement returns original result without double spend", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  const first = await wallet.settleRound({
    idempotencyKey: "spin-1",
    playerId: "p1",
    currency: "MMK",
    betMinor: 500,
    winMinor: 0,
    isFreeGame: false,
  });
  const second = await wallet.settleRound({
    idempotencyKey: "spin-1",
    playerId: "p1",
    currency: "MMK",
    betMinor: 500,
    winMinor: 0,
    isFreeGame: false,
  });
  assert.deepEqual(first, second);
  const balance = await wallet.getAvailableBalance("p1", "MMK");
  assert.equal(balance, 9_500);
});

test("idempotency key reused with different parameters throws", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  await wallet.settleRound({
    idempotencyKey: "spin-1",
    playerId: "p1",
    currency: "MMK",
    betMinor: 500,
    winMinor: 0,
    isFreeGame: false,
  });
  await assert.rejects(
    wallet.settleRound({
      idempotencyKey: "spin-1",
      playerId: "p1",
      currency: "MMK",
      betMinor: 500,
      winMinor: 1_000,
      isFreeGame: false,
    }),
    /used with different parameters/i,
  );
});

test("concurrent spins cannot overdraw balance", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 1_000);
  const promises = Array.from({ length: 10 }, (_, i) =>
    wallet.settleRound({
      idempotencyKey: `concurrent-${i}`,
      playerId: "p1",
      currency: "MMK",
      betMinor: 200,
      winMinor: 0,
      isFreeGame: false,
    }),
  );
  const results = await Promise.allSettled(promises);
  const successes = results.filter((r) => r.status === "fulfilled");
  const failures = results.filter((r) => r.status === "rejected");
  assert.ok(successes.length <= 5, "cannot spend more than balance allows");
  assert.ok(failures.length >= 5, "excess spins must be rejected");
  failures.forEach((r) => {
    assert.ok(r.reason instanceof InsufficientBalanceError || r.reason.message.includes("balance"));
  });

  const balance = await wallet.getAvailableBalance("p1", "MMK");
  assert.equal(balance, 0);
});

test("ledger postings are balanced for every settlement", async () => {
  const wallet = new TestWalletAdapter();
  wallet.creditAvailable("p1", "MMK", 10_000);
  const settlement = await wallet.settleRound({
    idempotencyKey: "balanced",
    playerId: "p1",
    currency: "MMK",
    betMinor: 500,
    winMinor: 1_200,
    isFreeGame: false,
  });
  assert.equal(settlement.postings.reduce((sum, p) => sum + p.amountMinor, 0), 0);
  const betSum = settlement.postings
    .filter((p) => p.memo === "BET")
    .reduce((sum, p) => sum + p.amountMinor, 0);
  const payoutSum = settlement.postings
    .filter((p) => p.memo === "PAYOUT")
    .reduce((sum, p) => sum + p.amountMinor, 0);
  assert.equal(betSum, 0);
  assert.equal(payoutSum, 0);
});

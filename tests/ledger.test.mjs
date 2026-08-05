import assert from "node:assert/strict";
import test from "node:test";
import {
  assertBalancedPostings,
  buildSpinPostings,
} from "../lib/ledger.ts";

test("builds balanced stake and payout postings", () => {
  const postings = buildSpinPostings({
    playerAvailableAccountId: "player:mmk",
    gameClearingAccountId: "clearing:mmk",
    currency: "MMK",
    betMinor: 50,
    winMinor: 120,
    isFreeGame: false,
  });

  assert.equal(postings.length, 4);
  assert.equal(postings.reduce((sum, posting) => sum + posting.amountMinor, 0), 0);
  assert.doesNotThrow(() => assertBalancedPostings(postings));
});

test("free games never debit a stake", () => {
  const postings = buildSpinPostings({
    playerAvailableAccountId: "player:mmk",
    gameClearingAccountId: "clearing:mmk",
    currency: "MMK",
    betMinor: 0,
    winMinor: 500,
    isFreeGame: true,
  });

  assert.deepEqual(
    postings.map(({ amountMinor, memo }) => ({ amountMinor, memo })),
    [
      { amountMinor: -500, memo: "PAYOUT" },
      { amountMinor: 500, memo: "PAYOUT" },
    ],
  );
});

test("rejects malformed or unbalanced money movements", () => {
  assert.throws(
    () =>
      buildSpinPostings({
        playerAvailableAccountId: "player:mmk",
        gameClearingAccountId: "clearing:mmk",
        currency: "MMK",
        betMinor: 50.5,
        winMinor: 0,
        isFreeGame: false,
      }),
    /safe integer/,
  );
  assert.throws(
    () =>
      buildSpinPostings({
        playerAvailableAccountId: "player:mmk",
        gameClearingAccountId: "clearing:mmk",
        currency: "MMK",
        betMinor: 50,
        winMinor: 0,
        isFreeGame: true,
      }),
    /free-game round/,
  );
  assert.throws(
    () =>
      assertBalancedPostings([
        { accountId: "a", amountMinor: -50, currency: "MMK", memo: "BET" },
        { accountId: "b", amountMinor: 40, currency: "MMK", memo: "BET" },
      ]),
    /Unbalanced/,
  );
});

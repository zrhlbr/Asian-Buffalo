export type LedgerPosting = {
  accountId: string;
  amountMinor: number;
  currency: string;
  memo: "BET" | "PAYOUT";
};

function assertMinorAmount(name: string, value: number, allowZero = false): void {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new RangeError(`${name} must be a ${allowZero ? "non-negative" : "positive"} safe integer`);
  }
}

export function assertBalancedPostings(postings: readonly LedgerPosting[]): void {
  if (postings.length < 2) throw new Error("A ledger transaction requires at least two postings");
  const currencies = new Set(postings.map((posting) => posting.currency));
  if (currencies.size !== 1) throw new Error("A ledger transaction cannot mix currencies");
  postings.forEach((posting) => {
    if (!Number.isSafeInteger(posting.amountMinor) || posting.amountMinor === 0) {
      throw new RangeError("Every ledger posting must be a non-zero safe integer");
    }
  });
  const sum = postings.reduce((total, posting) => total + posting.amountMinor, 0);
  if (sum !== 0) throw new Error(`Unbalanced ledger transaction: ${sum}`);
}

export function buildSpinPostings(input: {
  playerAvailableAccountId: string;
  gameClearingAccountId: string;
  currency: string;
  betMinor: number;
  winMinor: number;
  isFreeGame: boolean;
}): LedgerPosting[] {
  assertMinorAmount("betMinor", input.betMinor, input.isFreeGame);
  assertMinorAmount("winMinor", input.winMinor, true);
  if (input.isFreeGame && input.betMinor !== 0) {
    throw new Error("A free-game round cannot debit a stake");
  }

  const postings: LedgerPosting[] = [];
  if (input.betMinor > 0) {
    postings.push(
      {
        accountId: input.playerAvailableAccountId,
        amountMinor: -input.betMinor,
        currency: input.currency,
        memo: "BET",
      },
      {
        accountId: input.gameClearingAccountId,
        amountMinor: input.betMinor,
        currency: input.currency,
        memo: "BET",
      },
    );
  }
  if (input.winMinor > 0) {
    postings.push(
      {
        accountId: input.gameClearingAccountId,
        amountMinor: -input.winMinor,
        currency: input.currency,
        memo: "PAYOUT",
      },
      {
        accountId: input.playerAvailableAccountId,
        amountMinor: input.winMinor,
        currency: input.currency,
        memo: "PAYOUT",
      },
    );
  }

  if (postings.length > 0) assertBalancedPostings(postings);
  return postings;
}

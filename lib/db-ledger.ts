/**
 * Durable double-entry ledger posting with CAS balances.
 * Truth: ledger_accounts.balance_minor + ledger_balances projection.
 */

import { assertBalancedPostings, type LedgerPosting } from "./ledger.ts";
import { ConcurrentModificationError } from "./wallet-adapter.ts";

export type PostedLedgerTransaction = {
  id: string;
  idempotencyKey: string;
  kind: "GAME_BET" | "GAME_PAYOUT" | "DEPOSIT" | "WITHDRAWAL" | "ADJUSTMENT" | "REVERSAL";
  status: "POSTED" | "REVERSED";
  requestHash: string;
  postedAt: string;
  postings: LedgerPosting[];
};

export class LedgerFailClosedError extends Error {
  readonly failClosed = true as const;
  constructor(message: string) {
    super(message);
    this.name = "LedgerFailClosedError";
  }
}

type AccountRow = {
  id: string;
  playerId: string | null;
  kind: string;
  currency: string;
  balanceMinor: number;
  version: number;
};

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

/** In-memory durable ledger for TEST path. */
export class MemoryLedger {
  private accounts = new Map<string, AccountRow>();
  private transactions = new Map<string, PostedLedgerTransaction>();
  private balances = new Map<string, { accountId: string; balanceMinor: number; version: number }>();
  private byIdempotency = new Map<string, string>();

  private accountKey(playerId: string, kind: string, currency: string): string {
    return `${playerId}:${kind}:${currency}`;
  }

  ensurePlayerAccounts(playerId: string, currency: string): {
    available: AccountRow;
    clearing: AccountRow;
  } {
    return {
      available: this.getOrCreate(playerId, "PLAYER_AVAILABLE", currency),
      clearing: this.getOrCreate(playerId, "GAME_CLEARING", currency),
    };
  }

  private getOrCreate(playerId: string, kind: string, currency: string): AccountRow {
    const key = this.accountKey(playerId, kind, currency);
    let row = this.accounts.get(key);
    if (!row) {
      row = { id: key, playerId, kind, currency, balanceMinor: 0, version: 0 };
      this.accounts.set(key, row);
      this.balances.set(row.id, { accountId: row.id, balanceMinor: 0, version: 0 });
    }
    return row;
  }

  getAccount(accountId: string): AccountRow {
    const account = [...this.accounts.values()].find((row) => row.id === accountId);
    if (!account) throw new LedgerFailClosedError(`Unknown account ${accountId}`);
    return account;
  }

  getBalance(accountId: string): number {
    const bal = this.balances.get(accountId);
    if (!bal) throw new LedgerFailClosedError(`Unknown balance for ${accountId}`);
    return bal.balanceMinor;
  }

  /** TEST gate: direct credit without external deposit rail. */
  forceCreditAvailableForTest(
    playerId: string,
    currency: string,
    amountMinor: number,
  ): void {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new RangeError("credit amount must be a positive safe integer");
    }
    const available = this.getOrCreate(playerId, "PLAYER_AVAILABLE", currency);
    available.balanceMinor += amountMinor;
    available.version += 1;
    this.balances.set(available.id, {
      accountId: available.id,
      balanceMinor: available.balanceMinor,
      version: available.version,
    });
  }

  post(input: {
    idempotencyKey: string;
    kind: PostedLedgerTransaction["kind"];
    requestHash: string;
    postings: LedgerPosting[];
  }): PostedLedgerTransaction {
    const existingId = this.byIdempotency.get(input.idempotencyKey);
    if (existingId) {
      const existing = this.transactions.get(existingId)!;
      if (existing.requestHash !== input.requestHash) {
        throw new LedgerFailClosedError("Ledger idempotency conflict (replay protection)");
      }
      return existing;
    }

    if (input.postings.length === 0) {
      throw new LedgerFailClosedError("Cannot post empty ledger transaction");
    }
    assertBalancedPostings(input.postings);

    const touched = input.postings.map((posting) => {
      const account = this.getAccount(posting.accountId);
      if (account.currency !== posting.currency) {
        throw new LedgerFailClosedError("Posting currency mismatch");
      }
      return { account, posting, versionBefore: account.version };
    });

    for (const item of touched) {
      if (item.account.version !== item.versionBefore) {
        throw new ConcurrentModificationError("Ledger account modified concurrently");
      }
    }

    const nextBalances = new Map<string, number>();
    for (const item of touched) {
      const prev = nextBalances.get(item.account.id) ?? item.account.balanceMinor;
      nextBalances.set(item.account.id, prev + item.posting.amountMinor);
    }
    for (const item of touched) {
      const next = nextBalances.get(item.account.id)!;
      if (item.account.kind === "PLAYER_AVAILABLE" && next < 0) {
        throw new LedgerFailClosedError("PLAYER_AVAILABLE would become negative");
      }
    }

    for (const item of touched) {
      item.account.balanceMinor = nextBalances.get(item.account.id)!;
      item.account.version += 1;
      this.balances.set(item.account.id, {
        accountId: item.account.id,
        balanceMinor: item.account.balanceMinor,
        version: item.account.version,
      });
    }

    const tx: PostedLedgerTransaction = {
      id: newId("ltx"),
      idempotencyKey: input.idempotencyKey,
      kind: input.kind,
      status: "POSTED",
      requestHash: input.requestHash,
      postedAt: new Date().toISOString(),
      postings: input.postings,
    };
    this.transactions.set(tx.id, tx);
    this.byIdempotency.set(input.idempotencyKey, tx.id);
    return tx;
  }

  reverse(originalIdempotencyKey: string, reversalIdempotencyKey: string): PostedLedgerTransaction {
    const originalId = this.byIdempotency.get(originalIdempotencyKey);
    if (!originalId) throw new LedgerFailClosedError("Original ledger transaction not found");
    const original = this.transactions.get(originalId)!;
    const existingReversal = this.byIdempotency.get(reversalIdempotencyKey);
    if (existingReversal) return this.transactions.get(existingReversal)!;

    const reversePostings = original.postings.map((posting) => ({
      ...posting,
      amountMinor: -posting.amountMinor,
    }));
    const reversal = this.post({
      idempotencyKey: reversalIdempotencyKey,
      kind: "REVERSAL",
      requestHash: `rev:${original.requestHash}`,
      postings: reversePostings,
    });
    original.status = "REVERSED";
    return reversal;
  }
}

/** TEST-only balance seed (does not create a ledger posting). */
export function seedTestAvailable(
  ledger: MemoryLedger,
  playerId: string,
  currency: string,
  amountMinor: number,
): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new RangeError("seed amount must be a positive safe integer");
  }
  ledger.forceCreditAvailableForTest(playerId, currency, amountMinor);
}

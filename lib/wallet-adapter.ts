/**
 * Wallet adapter interface and an in-memory test implementation.
 *
 * The test adapter enforces:
 * - integer minor-unit amounts only;
 * - non-negative balances;
 * - optimistic locking (version increments on every balance change);
 * - idempotent round settlement (same idempotencyKey returns the same result).
 *
 * It does NOT connect to any production wallet.
 */

import { buildSpinPostings, type LedgerPosting } from "./ledger.ts";

export type Currency = string;

export type WalletAccount = {
  id: string;
  playerId: string;
  kind: "PLAYER_AVAILABLE" | "GAME_CLEARING";
  currency: Currency;
  balanceMinor: number;
  version: number;
};

export type RoundSettlement = {
  idempotencyKey: string;
  playerId: string;
  currency: Currency;
  betMinor: number;
  winMinor: number;
  isFreeGame: boolean;
  postedAt: string;
  playerBalanceAfterMinor: number;
  postings: LedgerPosting[];
};

export interface WalletAdapter {
  ensurePlayerAccounts(playerId: string, currency: Currency): Promise<{
    available: WalletAccount;
    clearing: WalletAccount;
  }>;

  getAvailableBalance(playerId: string, currency: Currency): Promise<number>;

  /**
   * Atomically settle a game round.
   *
   * betMinor is moved from PLAYER_AVAILABLE to GAME_CLEARING.
   * winMinor is moved from GAME_CLEARING to PLAYER_AVAILABLE.
   * Free games must have betMinor === 0.
   *
   * The same (playerId, idempotencyKey) pair must always return the same
   * settlement without moving money a second time.
   */
  settleRound(input: {
    idempotencyKey: string;
    playerId: string;
    currency: Currency;
    betMinor: number;
    winMinor: number;
    isFreeGame: boolean;
  }): Promise<RoundSettlement>;
}

export class InsufficientBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientBalanceError";
  }
}

export class ConcurrentModificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConcurrentModificationError";
  }
}

export class DuplicateIdempotencyKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateIdempotencyKeyError";
  }
}

export class TestWalletAdapter implements WalletAdapter {
  private accounts = new Map<string, WalletAccount>();
  private settlements = new Map<string, RoundSettlement>();

  private accountKey(playerId: string, kind: WalletAccount["kind"], currency: Currency): string {
    return `${playerId}:${kind}:${currency}`;
  }

  private getOrCreateAccount(
    playerId: string,
    kind: WalletAccount["kind"],
    currency: Currency,
  ): WalletAccount {
    const key = this.accountKey(playerId, kind, currency);
    let account = this.accounts.get(key);
    if (!account) {
      account = {
        id: key,
        playerId,
        kind,
        currency,
        balanceMinor: 0,
        version: 0,
      };
      this.accounts.set(key, account);
    }
    return account;
  }

  async ensurePlayerAccounts(
    playerId: string,
    currency: Currency,
  ): Promise<{ available: WalletAccount; clearing: WalletAccount }> {
    return {
      available: this.getOrCreateAccount(playerId, "PLAYER_AVAILABLE", currency),
      clearing: this.getOrCreateAccount(playerId, "GAME_CLEARING", currency),
    };
  }

  async getAvailableBalance(playerId: string, currency: Currency): Promise<number> {
    const account = this.getOrCreateAccount(playerId, "PLAYER_AVAILABLE", currency);
    return account.balanceMinor;
  }

  /**
   * Credit the player's available account. Used to seed test balances.
   */
  creditAvailable(playerId: string, currency: Currency, amountMinor: number): void {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new RangeError("credit amount must be a positive safe integer");
    }
    const account = this.getOrCreateAccount(playerId, "PLAYER_AVAILABLE", currency);
    account.balanceMinor += amountMinor;
    account.version += 1;
  }

  async settleRound(input: {
    idempotencyKey: string;
    playerId: string;
    currency: Currency;
    betMinor: number;
    winMinor: number;
    isFreeGame: boolean;
  }): Promise<RoundSettlement> {
    const { idempotencyKey, playerId, currency, betMinor, winMinor, isFreeGame } = input;

    if (!Number.isSafeInteger(betMinor) || betMinor < 0) {
      throw new RangeError("betMinor must be a non-negative safe integer");
    }
    if (!Number.isSafeInteger(winMinor) || winMinor < 0) {
      throw new RangeError("winMinor must be a non-negative safe integer");
    }
    if (isFreeGame && betMinor !== 0) {
      throw new Error("Free-game round cannot debit a stake");
    }

    const cacheKey = `${playerId}:${idempotencyKey}`;
    const cached = this.settlements.get(cacheKey);
    if (cached) {
      if (
        cached.betMinor !== betMinor ||
        cached.winMinor !== winMinor ||
        cached.isFreeGame !== isFreeGame ||
        cached.currency !== currency
      ) {
        throw new DuplicateIdempotencyKeyError(
          `Idempotency key ${idempotencyKey} was used with different parameters`,
        );
      }
      return cached;
    }

    const available = this.getOrCreateAccount(playerId, "PLAYER_AVAILABLE", currency);
    const clearing = this.getOrCreateAccount(playerId, "GAME_CLEARING", currency);

    if (available.balanceMinor < betMinor) {
      throw new InsufficientBalanceError(
        `Player ${playerId} balance ${available.balanceMinor} < bet ${betMinor}`,
      );
    }

    // Optimistic locking: capture version, apply changes, then verify.
    const availableVersionBefore = available.version;
    const clearingVersionBefore = clearing.version;

    available.balanceMinor -= betMinor;
    available.balanceMinor += winMinor;
    clearing.balanceMinor += betMinor;
    clearing.balanceMinor -= winMinor;

    if (available.balanceMinor < 0) {
      // Rollback
      available.balanceMinor = available.balanceMinor + betMinor - winMinor;
      clearing.balanceMinor = clearing.balanceMinor - betMinor + winMinor;
      throw new InsufficientBalanceError(
        `Player ${playerId} balance would become negative after settlement`,
      );
    }

    if (available.version !== availableVersionBefore || clearing.version !== clearingVersionBefore) {
      // Rollback
      available.balanceMinor = available.balanceMinor + betMinor - winMinor;
      clearing.balanceMinor = clearing.balanceMinor - betMinor + winMinor;
      throw new ConcurrentModificationError("Account modified concurrently");
    }

    available.version += 1;
    clearing.version += 1;

    const postings = buildSpinPostings({
      playerAvailableAccountId: available.id,
      gameClearingAccountId: clearing.id,
      currency,
      betMinor,
      winMinor,
      isFreeGame,
    });

    const settlement: RoundSettlement = {
      idempotencyKey,
      playerId,
      currency,
      betMinor,
      winMinor,
      isFreeGame,
      postedAt: new Date().toISOString(),
      playerBalanceAfterMinor: available.balanceMinor,
      postings,
    };

    this.settlements.set(cacheKey, settlement);
    return settlement;
  }
}

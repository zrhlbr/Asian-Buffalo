/**
 * WalletAdapter backed by MoneyService (Intent + Provider + Ledger).
 * Preserves settleRound contract for orchestrator compatibility.
 */

import { MoneyService } from "./money-service.ts";
import {
  type Currency,
  type RoundSettlement,
  type WalletAccount,
  type WalletAdapter,
} from "./wallet-adapter.ts";
import { assertRealWalletAllowed, assertTestWalletAllowed } from "./wallet-mode.ts";

export class DbWalletAdapter implements WalletAdapter {
  private readonly money: MoneyService;
  constructor(money: MoneyService) {
    this.money = money;
  }

  async ensurePlayerAccounts(
    playerId: string,
    currency: Currency,
  ): Promise<{ available: WalletAccount; clearing: WalletAccount }> {
    assertTestWalletAllowed(this.money.mode);
    const { available, clearing } = this.money.ledger.ensurePlayerAccounts(
      playerId,
      currency,
    );
    return {
      available: {
        id: available.id,
        playerId,
        kind: "PLAYER_AVAILABLE",
        currency,
        balanceMinor: available.balanceMinor,
        version: available.version,
      },
      clearing: {
        id: clearing.id,
        playerId,
        kind: "GAME_CLEARING",
        currency,
        balanceMinor: clearing.balanceMinor,
        version: clearing.version,
      },
    };
  }

  async getAvailableBalance(playerId: string, currency: Currency): Promise<number> {
    return this.money.getAvailableBalance(playerId, currency);
  }

  async settleRound(input: {
    idempotencyKey: string;
    playerId: string;
    currency: Currency;
    betMinor: number;
    winMinor: number;
    isFreeGame: boolean;
  }): Promise<RoundSettlement> {
    return this.money.settleRound(input);
  }

  creditAvailable(playerId: string, currency: Currency, amountMinor: number): void {
    this.money.seed(playerId, currency, amountMinor);
  }
}

/** REAL adapter skeleton — always fail closed unless explicitly allowed. */
export class RealWalletAdapter implements WalletAdapter {
  private readonly allowRealMoney: boolean;
  private readonly mode: "REAL";
  constructor(allowRealMoney: boolean, mode: "REAL" = "REAL") {
    this.allowRealMoney = allowRealMoney;
    this.mode = mode;
  }

  private deny(): never {
    assertRealWalletAllowed(this.mode, this.allowRealMoney);
    throw new Error("REAL wallet adapter is not configured");
  }

  ensurePlayerAccounts(): Promise<{ available: WalletAccount; clearing: WalletAccount }> {
    return this.deny();
  }

  getAvailableBalance(): Promise<number> {
    return this.deny();
  }

  settleRound(): Promise<RoundSettlement> {
    return this.deny();
  }
}

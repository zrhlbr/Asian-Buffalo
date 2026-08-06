/**
 * ISOLATED MOCK — NOT on the formal runtime path.
 *
 * Kept only for offline visual QA / unit tests that explicitly import this file.
 * Production boot (boot.ts / game-client) must never import this module.
 *
 * Contains client RNG and demo balance by design; forbidden in formal play.
 */

import type { GameProvider, PresentationSpinResult, SpinRequest, SymbolId } from "./adapter.ts";
import { REELS, ROWS } from "./adapter.ts";

const STRIP: SymbolId[] = [
  "buffalo",
  "ten",
  "lion",
  "k",
  "antelope",
  "q",
  "elephant",
  "j",
  "zebra",
  "a",
  "nine",
  "buffalo",
  "wild",
  "scatter",
];

function rnd(n: number): number {
  return Math.floor(Math.random() * n);
}

/**
 * @deprecated Formal play must use FormalGameProvider.
 */
export class MockProvider implements GameProvider {
  private balance = 10_000;
  private freeGamesRemaining = 0;

  async ensureReady(): Promise<void> {
    /* no-op */
  }

  getBalance(): number {
    return this.balance;
  }

  getFreeGamesRemaining(): number {
    return this.freeGamesRemaining;
  }

  getMathVersionId(): string | null {
    return "mock-not-formal";
  }

  getSessionId(): string | null {
    return null;
  }

  canBet(totalBetMinor: number): boolean {
    if (this.freeGamesRemaining > 0) return true;
    return totalBetMinor > 0 && this.balance >= totalBetMinor;
  }

  async recoverLastRound(): Promise<PresentationSpinResult | null> {
    return null;
  }

  async spin(req: SpinRequest): Promise<PresentationSpinResult> {
    const totalBet = req.roomBase * req.betLevel * req.betMultiplier;
    const inFree = this.freeGamesRemaining > 0;
    if (!inFree) {
      if (!this.canBet(totalBet)) throw new Error("INSUFFICIENT_BALANCE");
      this.balance -= totalBet;
    } else {
      this.freeGamesRemaining -= 1;
    }
    await new Promise((r) => setTimeout(r, 20));
    const grid: SymbolId[][] = [];
    for (let r = 0; r < REELS; r++) {
      const col: SymbolId[] = [];
      for (let row = 0; row < ROWS; row++) col.push(STRIP[rnd(STRIP.length)]);
      grid.push(col);
    }
    return {
      roundId: `mock_${Date.now()}`,
      grid,
      winMinor: 0,
      totalBetMinor: totalBet,
      balanceAfterMinor: this.balance,
      lineWins: [],
      winningPositions: [],
      scatterCount: 0,
      scatterWin: 0,
      freeGamesRemaining: this.freeGamesRemaining,
      awardedFreeGames: 0,
      isFreeGame: inFree,
      mathVersion: "mock-not-formal",
    };
  }
}

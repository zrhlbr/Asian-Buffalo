/**
 * M5 presentation adapter boundary.
 *
 * Formal runtime path uses FormalGameProvider only.
 * MockProvider / client RNG / local pay evaluation MUST NOT be imported
 * from the production boot path (see mock-provider.ts — DEV/QA isolation).
 *
 * Big / Mega / Ultra / Jackpot tiers are UI-only and must never feed
 * RTP, balance, ledger, wallet, math, or settlement.
 */

import {
  BET_LEVELS,
  BET_MULTIPLIERS,
  GRID_COLUMNS,
  GRID_ROWS,
  PAYLINE_COUNT,
  ROOM_BASE_BETS,
  type SymbolId,
} from "../../lib/game-config.ts";

export const REELS = GRID_COLUMNS;
export const ROWS = GRID_ROWS;
export const LINES = PAYLINE_COUNT;

export type { SymbolId };

export type BetPreset = {
  roomBase: number;
  betLevel: number;
  betMultiplier: number;
  totalBetMinor: number;
};

export function listBetPresets(): BetPreset[] {
  const presets: BetPreset[] = [];
  for (const roomBase of ROOM_BASE_BETS) {
    for (const betLevel of BET_LEVELS) {
      for (const betMultiplier of BET_MULTIPLIERS) {
        presets.push({
          roomBase,
          betLevel,
          betMultiplier,
          totalBetMinor: roomBase * betLevel * betMultiplier,
        });
      }
    }
  }
  presets.sort((a, b) => a.totalBetMinor - b.totalBetMinor);
  return presets;
}

export const BET_PRESETS = listBetPresets();

/** Presentation spin request — bet knobs only; free-game state is server-owned. */
export interface SpinRequest {
  roomBase: number;
  betLevel: number;
  betMultiplier: number;
}

/** Presentation outcome mapped from server SpinResult — no local math. */
export interface PresentationSpinResult {
  roundId: string;
  grid: SymbolId[][];
  winMinor: number;
  totalBetMinor: number;
  balanceAfterMinor: number;
  lineWins: { line: number; symbol: string; count: number; payout: number }[];
  winningPositions: { reel: number; row: number }[];
  scatterCount: number;
  scatterWin: number;
  freeGamesRemaining: number;
  awardedFreeGames: number;
  isFreeGame: boolean;
  mathVersion: string;
}

export type PlayerAnnouncementDto = {
  id: string;
  title: string;
  level: string;
  locales: { zh: string; en: string; my: string };
  publishAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export interface GameProvider {
  ensureReady(): Promise<void>;
  getBalance(): number;
  /** Display currency code from wallet balance (presentation only). */
  getCurrency(): string;
  getFreeGamesRemaining(): number;
  getMathVersionId(): string | null;
  getSessionId(): string | null;
  canBet(totalBetMinor: number): boolean;
  spin(req: SpinRequest): Promise<PresentationSpinResult>;
  recoverLastRound(): Promise<PresentationSpinResult | null>;
  /** Re-read formal wallet balance (login/resume/recovery). */
  refreshBalance(): Promise<number>;
  /** Live PUBLISHED announcements (trilingual); empty if none. */
  fetchAnnouncements(): Promise<PlayerAnnouncementDto[]>;
}

/**
 * UI_ONLY celebration thresholds (× total bet).
 * Presentation only — must never alter totalWin, Balance, Ledger, RTP, or Settlement.
 * Super / Epic sit between Ultra and Jackpot (commercial ladder).
 */
export const WIN_TIERS = {
  big: 10,
  mega: 25,
  ultra: 50,
  super: 70,
  epic: 85,
  jackpot: 100,
} as const;
export const WIN_TIERS_UI_ONLY = true;
export type WinTier =
  | "none"
  | "big"
  | "mega"
  | "ultra"
  | "super"
  | "epic"
  | "jackpot";

export function winTier(winMinor: number, totalBetMinor: number): WinTier {
  const x = totalBetMinor > 0 ? winMinor / totalBetMinor : 0;
  if (x >= WIN_TIERS.jackpot) return "jackpot";
  if (x >= WIN_TIERS.epic) return "epic";
  if (x >= WIN_TIERS.super) return "super";
  if (x >= WIN_TIERS.ultra) return "ultra";
  if (x >= WIN_TIERS.mega) return "mega";
  if (x >= WIN_TIERS.big) return "big";
  return "none";
}

export const FORMAL_SYMBOLS: SymbolId[] = [
  "buffalo",
  "lion",
  "elephant",
  "zebra",
  "antelope",
  "a",
  "k",
  "q",
  "j",
  "ten",
  "nine",
  "wild",
  "scatter",
];

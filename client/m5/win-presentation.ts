/**
 * Win presentation choreography — UI_ONLY.
 *
 * Resolves commercial celebration tiers from client-visible spin fields
 * (line length, symbol, grid fill, win/bet multiplier). Never mutates
 * Wallet / Ledger / RTP / Math / Spin server / Round / Grid / Settlement.
 */

import type { PresentationSpinResult, SymbolId } from "./adapter.ts";
import { WIN_TIERS, winTier, type WinTier } from "./adapter.ts";

/** Full commercial ladder (presentation order ascending). */
export const PRESENTATION_TIER_ORDER = [
  "none",
  "normal",
  "medium",
  "strong",
  "fullscreen_common",
  "fullscreen_high",
  "fullscreen_buffalo",
  "big",
  "mega",
  "ultra",
  "super",
  "epic",
  "jackpot",
] as const;

export type PresentationTier = (typeof PRESENTATION_TIER_ORDER)[number];

export const COMMON_ANIMALS = ["zebra", "antelope"] as const;
export const HIGH_ANIMALS = ["lion", "elephant"] as const;
export const PREMIUM_ANIMAL = "buffalo" as const;

/** Grid cells needed for a "fullscreen" animal celebration (5×4 = 20). */
export const FULLSCREEN_CELL_THRESHOLD = 10;

export type BuffaloAction =
  | "none"
  | "roar"
  | "lowRoar"
  | "headUp"
  | "lookAtWin"
  | "bigWin"
  | "run"
  | "victory"
  | "charge"
  | "jumpOut"
  | "slowWalk"
  | "standRoar"
  | "breakReel"
  | "jackpot";

export type AudioCue =
  | "winNormal"
  | "winMedium"
  | "winStrong"
  | "fullscreenCommon"
  | "fullscreenHigh"
  | "fullscreenBuffalo"
  | "bigWin"
  | "megaWin"
  | "ultraWin"
  | "superWin"
  | "epicWin"
  | "jackpot"
  | "freeSpinEnter"
  | "coinDrop"
  | "thunder"
  | "pseudoWin"
  | "nearMiss";

export type ParticleStyle = "gold" | "goldPurple" | "temple" | "divine";

export interface TierChoreography {
  tier: PresentationTier;
  /** Rank for max() selection — mirrors PRESENTATION_TIER_ORDER index. */
  rank: number;
  /** Show full-screen celebration overlay (Big+). */
  hudOverlay: boolean;
  /** HUD all-gold / meter flash intensity 0–3. */
  hudFlash: 0 | 1 | 2 | 3;
  durationMs: number;
  numberRollMs: number;
  shake: number;
  shakeDecay: number;
  punchZoom: number;
  bloom: number;
  coinBurst: number;
  sparkBurst: number;
  sparkSpeed: number;
  coinRain: boolean;
  pillars: boolean;
  particleStyle: ParticleStyle;
  buffalo: BuffaloAction;
  audio: AudioCue[];
  /** Symbol win amplify 0–2 (shader). */
  symbolWin: 0 | 1 | 2;
  reelFrameGlow: number;
  colorWash: number;
  darkenBg: number;
  wind: number;
  lightning: number;
  slowMo: number;
  /** Species call for fullscreen animal tiers. */
  speciesCall: boolean;
}

const RANK: Record<PresentationTier, number> = Object.fromEntries(
  PRESENTATION_TIER_ORDER.map((t, i) => [t, i]),
) as Record<PresentationTier, number>;

/** Data-driven choreography — each higher tier must feel distinctly upgraded. */
export const TIER_CHOREOGRAPHY: Record<PresentationTier, TierChoreography> = {
  none: {
    tier: "none",
    rank: RANK.none,
    hudOverlay: false,
    hudFlash: 0,
    durationMs: 0,
    numberRollMs: 0,
    shake: 0,
    shakeDecay: 4,
    punchZoom: 0,
    bloom: 0.2,
    coinBurst: 0,
    sparkBurst: 0,
    sparkSpeed: 5,
    coinRain: false,
    pillars: false,
    particleStyle: "gold",
    buffalo: "none",
    audio: [],
    symbolWin: 0,
    reelFrameGlow: 0,
    colorWash: 0,
    darkenBg: 0,
    wind: 0,
    lightning: 0,
    slowMo: 0,
    speciesCall: false,
  },
  normal: {
    tier: "normal",
    rank: RANK.normal,
    hudOverlay: false,
    hudFlash: 1,
    durationMs: 1000,
    numberRollMs: 700,
    shake: 0.06,
    shakeDecay: 6.5,
    punchZoom: 0.08,
    bloom: 0.22,
    coinBurst: 28,
    sparkBurst: 24,
    sparkSpeed: 3.5,
    coinRain: false,
    pillars: false,
    particleStyle: "gold",
    buffalo: "none",
    audio: ["winNormal", "coinDrop"],
    symbolWin: 1,
    reelFrameGlow: 0.15,
    colorWash: 0,
    darkenBg: 0,
    wind: 0,
    lightning: 0,
    slowMo: 0,
    speciesCall: false,
  },
  medium: {
    tier: "medium",
    rank: RANK.medium,
    hudOverlay: false,
    hudFlash: 1,
    durationMs: 1400,
    numberRollMs: 900,
    shake: 0.1,
    shakeDecay: 5.8,
    punchZoom: 0.16,
    bloom: 0.26,
    coinBurst: 55,
    sparkBurst: 48,
    sparkSpeed: 4.5,
    coinRain: false,
    pillars: false,
    particleStyle: "gold",
    buffalo: "lowRoar",
    audio: ["winMedium"],
    symbolWin: 1,
    reelFrameGlow: 0.35,
    colorWash: 0.08,
    darkenBg: 0,
    wind: 0,
    lightning: 0,
    slowMo: 0,
    speciesCall: false,
  },
  strong: {
    tier: "strong",
    rank: RANK.strong,
    hudOverlay: false,
    hudFlash: 2,
    durationMs: 1800,
    numberRollMs: 1100,
    shake: 0.16,
    shakeDecay: 5.2,
    punchZoom: 0.22,
    bloom: 0.3,
    coinBurst: 90,
    sparkBurst: 80,
    sparkSpeed: 6,
    coinRain: false,
    pillars: true,
    particleStyle: "goldPurple",
    buffalo: "headUp",
    audio: ["winStrong", "thunder"],
    symbolWin: 2,
    reelFrameGlow: 0.5,
    colorWash: 0.16,
    darkenBg: 0.05,
    wind: 0.2,
    lightning: 0.25,
    slowMo: 0,
    speciesCall: false,
  },
  fullscreen_common: {
    tier: "fullscreen_common",
    rank: RANK.fullscreen_common,
    hudOverlay: false,
    hudFlash: 2,
    durationMs: 2200,
    numberRollMs: 1200,
    shake: 0.14,
    shakeDecay: 5,
    punchZoom: 0.28,
    bloom: 0.32,
    coinBurst: 110,
    sparkBurst: 100,
    sparkSpeed: 6.5,
    coinRain: false,
    pillars: true,
    particleStyle: "gold",
    buffalo: "lookAtWin",
    audio: ["fullscreenCommon"],
    symbolWin: 2,
    reelFrameGlow: 0.55,
    colorWash: 0.35,
    darkenBg: 0.08,
    wind: 0.25,
    lightning: 0,
    slowMo: 0,
    speciesCall: true,
  },
  fullscreen_high: {
    tier: "fullscreen_high",
    rank: RANK.fullscreen_high,
    hudOverlay: false,
    hudFlash: 2,
    durationMs: 2800,
    numberRollMs: 1400,
    shake: 0.22,
    shakeDecay: 4.6,
    punchZoom: 0.36,
    bloom: 0.36,
    coinBurst: 150,
    sparkBurst: 140,
    sparkSpeed: 7.5,
    coinRain: true,
    pillars: true,
    particleStyle: "goldPurple",
    buffalo: "lookAtWin",
    audio: ["fullscreenHigh"],
    symbolWin: 2,
    reelFrameGlow: 0.75,
    colorWash: 0.4,
    darkenBg: 0.12,
    wind: 0.35,
    lightning: 0.2,
    slowMo: 0,
    speciesCall: true,
  },
  fullscreen_buffalo: {
    tier: "fullscreen_buffalo",
    rank: RANK.fullscreen_buffalo,
    // Long grid celeb uses FX hold (8–12s), not Big Win chrome
    hudOverlay: false,
    hudFlash: 3,
    durationMs: 10000,
    numberRollMs: 2800,
    shake: 0.3,
    shakeDecay: 3.8,
    punchZoom: 0.55,
    bloom: 0.42,
    coinBurst: 220,
    sparkBurst: 200,
    sparkSpeed: 9,
    coinRain: true,
    pillars: true,
    particleStyle: "divine",
    buffalo: "charge",
    audio: ["fullscreenBuffalo", "thunder"],
    symbolWin: 2,
    reelFrameGlow: 0.9,
    colorWash: 0.55,
    darkenBg: 0.18,
    wind: 0.85,
    lightning: 0.7,
    slowMo: 0.15,
    speciesCall: true,
  },
  big: {
    tier: "big",
    rank: RANK.big,
    hudOverlay: true,
    hudFlash: 2,
    durationMs: 2800,
    numberRollMs: 1800,
    shake: 0.18,
    shakeDecay: 5.2,
    punchZoom: 0.36,
    bloom: 0.34,
    /* Clarity: slightly fewer particles so symbols/HUD stay primary */
    coinBurst: 110,
    sparkBurst: 130,
    sparkSpeed: 7,
    coinRain: true,
    pillars: true,
    /* Mythic accent: cloud-sweep / temple gold — presentation mapping only */
    particleStyle: "temple",
    buffalo: "bigWin",
    audio: ["bigWin"],
    symbolWin: 2,
    reelFrameGlow: 0.68,
    colorWash: 0.2,
    darkenBg: 0.1,
    wind: 0.3,
    lightning: 0.15,
    slowMo: 0,
    speciesCall: false,
  },
  mega: {
    tier: "mega",
    rank: RANK.mega,
    hudOverlay: true,
    hudFlash: 2,
    durationMs: 3600,
    numberRollMs: 2200,
    shake: 0.28,
    shakeDecay: 4.4,
    punchZoom: 0.5,
    bloom: 0.38,
    coinBurst: 190,
    sparkBurst: 230,
    sparkSpeed: 8,
    coinRain: true,
    pillars: true,
    /* Mythic accent: lotus / array — presentation mapping only */
    particleStyle: "temple",
    buffalo: "run",
    audio: ["megaWin"],
    symbolWin: 2,
    reelFrameGlow: 0.7,
    colorWash: 0.25,
    darkenBg: 0.22,
    wind: 0.4,
    lightning: 0.25,
    slowMo: 0,
    speciesCall: false,
  },
  ultra: {
    tier: "ultra",
    rank: RANK.ultra,
    hudOverlay: true,
    hudFlash: 3,
    durationMs: 4400,
    numberRollMs: 2600,
    shake: 0.4,
    shakeDecay: 3.5,
    punchZoom: 0.64,
    bloom: 0.44,
    coinBurst: 260,
    sparkBurst: 320,
    sparkSpeed: 9.5,
    coinRain: true,
    pillars: true,
    /* Mythic accent: heaven pillars — presentation mapping only */
    particleStyle: "divine",
    buffalo: "jumpOut",
    audio: ["ultraWin"],
    symbolWin: 2,
    reelFrameGlow: 0.85,
    colorWash: 0.45,
    darkenBg: 0.28,
    wind: 0.55,
    lightning: 0.45,
    slowMo: 0.1,
    speciesCall: false,
  },
  super: {
    tier: "super",
    rank: RANK.super,
    hudOverlay: true,
    hudFlash: 3,
    durationMs: 5200,
    numberRollMs: 3000,
    shake: 0.36,
    shakeDecay: 3.2,
    punchZoom: 0.7,
    bloom: 0.46,
    coinBurst: 300,
    sparkBurst: 360,
    sparkSpeed: 10,
    coinRain: true,
    pillars: true,
    particleStyle: "temple",
    buffalo: "slowWalk",
    audio: ["superWin"],
    symbolWin: 2,
    reelFrameGlow: 0.92,
    colorWash: 0.5,
    darkenBg: 0.32,
    wind: 0.6,
    lightning: 0.5,
    slowMo: 0.2,
    speciesCall: false,
  },
  epic: {
    tier: "epic",
    rank: RANK.epic,
    hudOverlay: true,
    hudFlash: 3,
    durationMs: 6200,
    numberRollMs: 3400,
    shake: 0.44,
    shakeDecay: 2.8,
    punchZoom: 0.76,
    bloom: 0.48,
    coinBurst: 340,
    sparkBurst: 400,
    sparkSpeed: 11,
    coinRain: true,
    pillars: true,
    /* Mythic accent: gate-open / divine — presentation mapping only */
    particleStyle: "divine",
    buffalo: "standRoar",
    audio: ["epicWin", "thunder"],
    symbolWin: 2,
    reelFrameGlow: 0.96,
    colorWash: 0.6,
    darkenBg: 0.36,
    wind: 0.75,
    lightning: 0.85,
    slowMo: 0.35,
    speciesCall: false,
  },
  jackpot: {
    tier: "jackpot",
    rank: RANK.jackpot,
    hudOverlay: true,
    hudFlash: 3,
    durationMs: 7500,
    numberRollMs: 3800,
    shake: 0.55,
    shakeDecay: 2.6,
    punchZoom: 0.85,
    bloom: 0.52,
    coinBurst: 400,
    sparkBurst: 420,
    sparkSpeed: 12,
    coinRain: true,
    pillars: true,
    particleStyle: "divine",
    buffalo: "breakReel",
    audio: ["jackpot"],
    symbolWin: 2,
    reelFrameGlow: 1,
    colorWash: 0.7,
    darkenBg: 0.42,
    wind: 1,
    lightning: 1,
    slowMo: 0.25,
    speciesCall: false,
  },
};

/** Free-spin enter — separate from win ladder; presentation only. */
export const FREE_SPIN_ENTER_CHOREO: Omit<TierChoreography, "tier" | "rank"> & {
  tier: "free_spin_enter";
  rank: number;
} = {
  tier: "free_spin_enter",
  rank: -1,
  hudOverlay: false,
  hudFlash: 2,
  durationMs: 2200,
  numberRollMs: 0,
  shake: 0.2,
  shakeDecay: 4.5,
  punchZoom: 0.4,
  bloom: 0.36,
  coinBurst: 80,
  sparkBurst: 120,
  sparkSpeed: 7,
  coinRain: false,
  pillars: true,
  particleStyle: "temple",
  buffalo: "roar",
  audio: ["freeSpinEnter"],
  symbolWin: 1,
  reelFrameGlow: 0.65,
  colorWash: 0.3,
  darkenBg: 0.1,
  wind: 0.45,
  lightning: 0.2,
  slowMo: 0,
  speciesCall: false,
};

export function tierRank(tier: PresentationTier): number {
  return RANK[tier] ?? 0;
}

export function isOverlayTier(tier: PresentationTier): boolean {
  return TIER_CHOREOGRAPHY[tier].hudOverlay;
}

/** Multiplier-band tier → presentation tier (includes Super/Epic). */
export function multiplierToPresentation(tier: WinTier): PresentationTier {
  if (tier === "none") return "none";
  return tier;
}

export function countSymbolOnGrid(grid: SymbolId[][], symbol: SymbolId): number {
  let n = 0;
  for (const col of grid) {
    for (const cell of col) {
      if (cell === symbol) n++;
    }
  }
  return n;
}

export function maxLineCount(result: PresentationSpinResult): number {
  let max = 0;
  for (const w of result.lineWins) {
    if (w.count > max) max = w.count;
  }
  return max;
}

export function dominantWinSymbol(result: PresentationSpinResult): SymbolId | null {
  let best: { symbol: string; payout: number; count: number } | null = null;
  for (const w of result.lineWins) {
    if (
      !best ||
      w.payout > best.payout ||
      (w.payout === best.payout && w.count > best.count)
    ) {
      best = { symbol: w.symbol, payout: w.payout, count: w.count };
    }
  }
  return (best?.symbol as SymbolId) ?? null;
}

function lineLengthTier(maxCount: number): PresentationTier {
  if (maxCount >= 5) return "strong";
  if (maxCount >= 4) return "medium";
  if (maxCount >= 3) return "normal";
  return "none";
}

function fullscreenAnimalTier(result: PresentationSpinResult): PresentationTier {
  const buffaloN = countSymbolOnGrid(result.grid, "buffalo");
  if (buffaloN >= FULLSCREEN_CELL_THRESHOLD) return "fullscreen_buffalo";

  let highN = 0;
  for (const s of HIGH_ANIMALS) {
    highN = Math.max(highN, countSymbolOnGrid(result.grid, s));
  }
  if (highN >= FULLSCREEN_CELL_THRESHOLD) return "fullscreen_high";

  let commonN = 0;
  for (const s of COMMON_ANIMALS) {
    commonN = Math.max(commonN, countSymbolOnGrid(result.grid, s));
  }
  if (commonN >= FULLSCREEN_CELL_THRESHOLD) return "fullscreen_common";

  return "none";
}

/**
 * Resolve the highest presentation tier from server-mapped result fields.
 * Presentation only — does not alter payout / balance / ledger.
 */
export function resolvePresentationTier(
  result: PresentationSpinResult,
): PresentationTier {
  if (result.winMinor <= 0 && result.lineWins.length === 0) return "none";

  const multTier = multiplierToPresentation(
    winTier(result.winMinor, result.totalBetMinor),
  );
  const lineTier = lineLengthTier(maxLineCount(result));
  const fsTier = result.winMinor > 0 ? fullscreenAnimalTier(result) : "none";

  let best: PresentationTier = "none";
  for (const t of [multTier, lineTier, fsTier] as PresentationTier[]) {
    if (tierRank(t) > tierRank(best)) best = t;
  }
  // Tiny wins with no 3-of-kind line still get a soft normal cue if paid
  if (best === "none" && result.winMinor > 0) return "normal";
  return best;
}

export function choreographyFor(tier: PresentationTier): TierChoreography {
  return TIER_CHOREOGRAPHY[tier];
}

/** Contract: Super and Epic sit strictly between Ultra and Jackpot. */
export function assertMultiplierBandOrder(): boolean {
  return (
    WIN_TIERS.big < WIN_TIERS.mega &&
    WIN_TIERS.mega < WIN_TIERS.ultra &&
    WIN_TIERS.ultra < WIN_TIERS.super &&
    WIN_TIERS.super < WIN_TIERS.epic &&
    WIN_TIERS.epic < WIN_TIERS.jackpot
  );
}

export function presentationTierOrder(): readonly PresentationTier[] {
  return PRESENTATION_TIER_ORDER;
}

/* ─── Option 1: LDW (pseudoWin) + Near-Miss — presentation only ─── */

/** Near-miss show rate among true misses (deterministic hash seed — not RNG paint). */
export const NEAR_MISS_PROBABILITY_PCT = 35;

/** High-value / scatter-like symbols preferred for near-miss edge accent. */
export const NEAR_MISS_ACCENT_SYMBOLS: readonly SymbolId[] = [
  "scatter",
  "wild",
  "buffalo",
  "lion",
  "elephant",
];

export type QualityFxTier = "ultra" | "high" | "medium" | "low";

export interface PresentationOutcome {
  /** Existing commercial ladder (Big+ unchanged for large real wins). */
  tier: PresentationTier;
  /** Losses Disguised as Wins: 0 < payout < bet — celebratory light FX, real meter. */
  pseudoWin: boolean;
  /** True miss + deterministic ~35% — visual accent only, never invents a win. */
  nearMiss: boolean;
  /** Grid cells to accent for near-miss (subset of server grid; never rewritten). */
  nearMissCells: Array<[number, number]>;
  /** Reel index emphasized for last-stop illusion (presentation only). */
  nearMissReel: number;
}

/** FNV-1a 32-bit — stable across SSR/CSR; avoids non-deterministic paint seeds. */
export function hashRoundSeed(id: string): number {
  let h = 2166136261 >>> 0;
  const s = id || "";
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** LDW: server paid something but less than total bet (multiplier ∈ (0,1)). */
export function isPseudoWin(winMinor: number, totalBetMinor: number): boolean {
  return winMinor > 0 && totalBetMinor > 0 && winMinor < totalBetMinor;
}

/** True miss from existing fields — no payout and no line wins. */
export function isTrueMiss(result: PresentationSpinResult): boolean {
  return result.winMinor <= 0 && result.lineWins.length === 0;
}

/**
 * Near-miss eligibility roll — deterministic from roundId (~35%).
 * Never used for money / RTP / settlement.
 */
export function shouldShowNearMiss(result: PresentationSpinResult): boolean {
  if (!isTrueMiss(result)) return false;
  return hashRoundSeed(result.roundId) % 100 < NEAR_MISS_PROBABILITY_PCT;
}

/** Quality LOD scale for near-miss / LDW FX — LOW softens; never blocks spin. */
export function presentationFxScale(tier: QualityFxTier | string | null | undefined): number {
  switch (tier) {
    case "low":
      return 0.35;
    case "medium":
      return 0.65;
    case "high":
      return 0.9;
    case "ultra":
      return 1;
    default:
      return 0.9;
  }
}

/**
 * Pick accent cells from the **server** grid only — do not invent symbols.
 * Prefer high-value / scatter near rightmost reels (stop-edge illusion).
 */
export function pickNearMissAccents(
  result: PresentationSpinResult,
): { cells: Array<[number, number]>; reelIndex: number } {
  const grid = result.grid;
  const reels = grid.length;
  const seed = hashRoundSeed(result.roundId);
  const preferredReel = reels > 0 ? Math.min(reels - 1, 3 + (seed % Math.max(1, reels - 3))) : 0;

  const scored: Array<{ reel: number; row: number; score: number }> = [];
  for (let r = 0; r < reels; r++) {
    const col = grid[r];
    if (!col) continue;
    for (let row = 0; row < col.length; row++) {
      const sym = col[row] as SymbolId;
      const rank = NEAR_MISS_ACCENT_SYMBOLS.indexOf(sym);
      if (rank < 0) continue;
      const edgeBias = r >= preferredReel - 1 ? 3 : r >= reels - 2 ? 2 : 0;
      scored.push({ reel: r, row, score: (NEAR_MISS_ACCENT_SYMBOLS.length - rank) * 10 + edgeBias + (r === preferredReel ? 5 : 0) });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.reel - b.reel || a.row - b.row);
  const cells: Array<[number, number]> = [];
  const seen = new Set<string>();
  for (const c of scored) {
    const key = `${c.reel}:${c.row}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cells.push([c.reel, c.row]);
    if (cells.length >= 3) break;
  }

  // Soft fallback: pulse a cell on the preferred reel without claiming a payline
  if (cells.length === 0 && reels > 0) {
    const col = grid[preferredReel] ?? grid[reels - 1]!;
    const row = seed % Math.max(1, col.length);
    cells.push([preferredReel, row]);
  }

  return { cells, reelIndex: preferredReel };
}

/**
 * Resolve presentation outcome from server-mapped fields only.
 * Does not alter payout / balance / ledger / grid authority.
 */
export function resolvePresentationOutcome(
  result: PresentationSpinResult,
): PresentationOutcome {
  const tier = resolvePresentationTier(result);
  const pseudoWin = isPseudoWin(result.winMinor, result.totalBetMinor);
  const nearMiss = !pseudoWin && shouldShowNearMiss(result);
  const accents = nearMiss
    ? pickNearMissAccents(result)
    : { cells: [] as Array<[number, number]>, reelIndex: 0 };

  return {
    // LDW stays below Big+ — never promote small pays into overlay ladder
    tier: pseudoWin && tierRank(tier) >= tierRank("big") ? "normal" : tier,
    pseudoWin,
    nearMiss,
    nearMissCells: accents.cells,
    nearMissReel: accents.reelIndex,
  };
}

/** Light celebratory choreography for LDW — meters still show real winMinor. */
export const PSEUDO_WIN_CHOREO: TierChoreography = {
  tier: "normal",
  rank: RANK.normal,
  hudOverlay: false,
  hudFlash: 1,
  durationMs: 1100,
  numberRollMs: 700,
  shake: 0.05,
  shakeDecay: 6.5,
  punchZoom: 0.1,
  bloom: 0.24,
  coinBurst: 36,
  sparkBurst: 32,
  sparkSpeed: 3.8,
  coinRain: false,
  pillars: false,
  particleStyle: "gold",
  buffalo: "none",
  audio: ["pseudoWin", "coinDrop"],
  symbolWin: 1,
  reelFrameGlow: 0.22,
  colorWash: 0.06,
  darkenBg: 0,
  wind: 0,
  lightning: 0,
  slowMo: 0,
  speciesCall: false,
};

/** Near-miss stop accent — teaser FX only; no win claim / no coin rain. */
export const NEAR_MISS_CHOREO: Omit<TierChoreography, "tier" | "rank"> & {
  tier: "near_miss";
  rank: number;
} = {
  tier: "near_miss",
  rank: -2,
  hudOverlay: false,
  hudFlash: 0,
  durationMs: 700,
  numberRollMs: 0,
  shake: 0.03,
  shakeDecay: 7,
  punchZoom: 0.04,
  bloom: 0.22,
  coinBurst: 0,
  sparkBurst: 18,
  sparkSpeed: 3.2,
  coinRain: false,
  pillars: false,
  particleStyle: "gold",
  buffalo: "none",
  audio: ["nearMiss"],
  symbolWin: 0,
  reelFrameGlow: 0.4,
  colorWash: 0.04,
  darkenBg: 0,
  wind: 0.05,
  lightning: 0,
  slowMo: 0,
  speciesCall: false,
};

/** Scale a choreography copy by quality FX intensity (presentation only). */
export function scaleChoreographyFx<T extends TierChoreography | typeof NEAR_MISS_CHOREO>(
  choreo: T,
  fxScale: number,
): T {
  const s = Math.min(1, Math.max(0.2, fxScale));
  return {
    ...choreo,
    shake: choreo.shake * s,
    punchZoom: choreo.punchZoom * s,
    coinBurst: Math.round(choreo.coinBurst * s),
    sparkBurst: Math.round(choreo.sparkBurst * s),
    reelFrameGlow: choreo.reelFrameGlow * s,
    colorWash: choreo.colorWash * s,
    bloom: 0.2 + (choreo.bloom - 0.2) * s,
  };
}

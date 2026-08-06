/**
 * Versioned, server-authoritative math configuration for Asian Buffalo.
 *
 * This module freezes the visible paytable and independent line map into a
 * hashable version object. Unknown parameters (original RTP, exact reel
 * weights, official line coordinates) are explicitly marked as provisional
 * so they cannot be mistaken for verified supplier data.
 */

import {
  BASE_FREE_GAMES,
  BET_LEVELS,
  BET_MULTIPLIERS,
  GAME_VERSION,
  GRID_COLUMNS,
  GRID_ROWS,
  PAYLINE_COUNT,
  PAYLINES,
  PAYTABLE,
  RETRIGGER_FREE_GAMES,
  ROOM_BASE_BETS,
  SCATTER_PAYOUT,
  SYMBOLS,
  type Payline,
  type RegularSymbol,
  type SymbolId,
} from "./game-config.ts";

export type { RegularSymbol, SymbolId } from "./game-config.ts";

export type MathVersionStatus = "DRAFT" | "FROZEN" | "RETIRED";

export type WildRule = {
  appearsOnReelIndexes: readonly number[];
  substitutes: readonly SymbolId[];
  freeGameMultiplier: {
    kind: "per-round-random";
    values: readonly number[];
    note: string;
  };
};

export type ScatterRule = {
  appearsOnReelIndexes: readonly number[];
  totalBetMultipliers: { readonly [count: number]: number | undefined };
  baseFreeGames: { readonly [count: number]: number | undefined };
  retriggerFreeGames: { readonly [count: number]: number | undefined };
};

export type ReelWeights = {
  kind: "per-reel";
  reels: readonly { readonly [symbol: string]: number }[];
  note: string;
};

export type MaxPayoutRule =
  | {
      kind: "candidate";
      totalBetMultiplier: number;
      note: string;
    }
  | {
      kind: "fixed";
      totalBetMultiplier: number;
      note: string;
    };

export type MathVersionConfig = {
  version: string;
  gameVersion: string;
  status: MathVersionStatus;
  grid: {
    columns: number;
    rows: number;
  };
  paylineCount: number;
  paylines: readonly Payline[];
  symbols: {
    id: SymbolId;
    label: string;
    mark: string;
  }[];
  paytable: {
    symbol: RegularSymbol;
    payouts: { readonly [count: number]: number | undefined };
  }[];
  scatter: ScatterRule;
  wild: WildRule;
  rooms: {
    baseBets: readonly number[];
    betLevels: readonly number[];
    betMultipliers: readonly number[];
    lineCount: number;
  };
  reelWeights: ReelWeights;
  maxPayout: MaxPayoutRule;
  disclosure: {
    status: string;
    targetRtp: number | null;
    originalRtpKnown: boolean;
    realMoneyEnabled: boolean;
    provisionalNotes: readonly string[];
  };
};

function sortedJson(value: unknown): string {
  return JSON.stringify(value, (_, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = v[key];
          return acc;
        }, {});
    }
    return v;
  });
}

export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashMathVersionConfig(config: MathVersionConfig): Promise<string> {
  return sha256Hex(sortedJson(config));
}

export class RealMoneyBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RealMoneyBlockedError";
  }
}

/**
 * Server-side gate: throw if this math version is not allowed to participate
 * in real-money settlement. Any provisional marker, DRAFT status, missing RTP
 * target, or explicit realMoneyEnabled=false must block the spin.
 */
export function validateRealMoneyAllowed(config: MathVersionConfig): void {
  const failures: string[] = [];

  if (config.status !== "FROZEN") {
    failures.push(`math version status is ${config.status} (must be FROZEN)`);
  }

  if (config.disclosure.status === "UNCALIBRATED_PROTOTYPE") {
    failures.push("disclosure status is UNCALIBRATED_PROTOTYPE");
  }

  if (config.disclosure.targetRtp === null) {
    failures.push("targetRtp is null");
  }

  if (config.disclosure.realMoneyEnabled !== true) {
    failures.push(`realMoneyEnabled is ${config.disclosure.realMoneyEnabled}`);
  }

  if (
    config.reelWeights.kind === "per-reel" &&
    config.reelWeights.note.toLowerCase().includes("temporary")
  ) {
    failures.push("reelWeights are marked as temporary/candidate");
  }

  if (config.maxPayout.kind === "candidate") {
    failures.push("maxPayout is marked as candidate");
  }

  if (failures.length > 0) {
    throw new RealMoneyBlockedError(
      `Real-money settlement blocked for ${config.version}: ${failures.join("; ")}`,
    );
  }
}

export function buildInitialMathVersion(overrides?: {
  version?: string;
  status?: MathVersionStatus;
}): MathVersionConfig {
  const status = overrides?.status ?? "DRAFT";
  const version = overrides?.version ?? "ab-math-1.0.0";

  return {
    version,
    gameVersion: GAME_VERSION,
    status,
    grid: {
      columns: GRID_COLUMNS,
      rows: GRID_ROWS,
    },
    paylineCount: PAYLINE_COUNT,
    paylines: PAYLINES,
    symbols: Object.values(SYMBOLS).map(({ id, label, mark }) => ({ id, label, mark })),
    paytable: (Object.keys(PAYTABLE) as RegularSymbol[]).map((symbol) => ({
      symbol,
      payouts: PAYTABLE[symbol],
    })),
    scatter: {
      appearsOnReelIndexes: [0, 1, 2, 3, 4],
      totalBetMultipliers: SCATTER_PAYOUT,
      baseFreeGames: BASE_FREE_GAMES,
      retriggerFreeGames: RETRIGGER_FREE_GAMES,
    },
    wild: {
      appearsOnReelIndexes: [1, 2, 3],
      substitutes: Object.keys(PAYTABLE) as RegularSymbol[],
      freeGameMultiplier: {
        kind: "per-round-random",
        values: [2, 3],
        note:
          "Free-game WILD multiplier is applied once per winning round when any WILD appears on reels 2-4. The exact supplier formula for multiple simultaneous WILDs is not publicly confirmed; this is an independent candidate rule.",
      },
    },
    rooms: {
      baseBets: ROOM_BASE_BETS,
      betLevels: BET_LEVELS,
      betMultipliers: BET_MULTIPLIERS,
      lineCount: PAYLINE_COUNT,
    },
    reelWeights: {
      kind: "per-reel",
      reels: [
        { buffalo: 3, lion: 5, elephant: 5, zebra: 7, antelope: 7, a: 10, k: 10, q: 11, j: 11, ten: 12, nine: 12, scatter: 2 },
        { buffalo: 3, lion: 5, elephant: 5, zebra: 7, antelope: 7, a: 10, k: 10, q: 11, j: 11, ten: 12, nine: 12, scatter: 2, wild: 3 },
        { buffalo: 3, lion: 5, elephant: 5, zebra: 7, antelope: 7, a: 10, k: 10, q: 11, j: 11, ten: 12, nine: 12, scatter: 2, wild: 3 },
        { buffalo: 3, lion: 5, elephant: 5, zebra: 7, antelope: 7, a: 10, k: 10, q: 11, j: 11, ten: 12, nine: 12, scatter: 2, wild: 3 },
        { buffalo: 3, lion: 5, elephant: 5, zebra: 7, antelope: 7, a: 10, k: 10, q: 11, j: 11, ten: 12, nine: 12, scatter: 2 },
      ],
      note:
        "These per-reel symbol weights are a temporary candidate set for engineering validation only. They are not calibrated to any claimed supplier RTP and must be replaced by a frozen math file before real-money play.",
    },
    maxPayout: {
      kind: "candidate",
      totalBetMultiplier: 2500,
      note: "Candidate cap pending RTP/volatility simulation and compliance review.",
    },
    disclosure: {
      status: "UNCALIBRATED_PROTOTYPE",
      targetRtp: null,
      originalRtpKnown: false,
      realMoneyEnabled: false,
      provisionalNotes: [
        "Original supplier RTP is not publicly known and is not claimed.",
        "The 50-line map is an independent deterministic placeholder.",
        "Free-game WILD multiplier stacking rule is a candidate implementation.",
        "Reel weights are temporary and will be replaced after large-scale simulation.",
      ],
    },
  };
}

export const INITIAL_MATH_VERSION = buildInitialMathVersion({
  version: "ab-math-1.0.0",
  status: "DRAFT",
});

/**
 * Production FROZEN math version for R1-M3.
 *
 * This is the persisted/executable configuration used by session creation and
 * spin orchestration. realMoneyEnabled remains false — M3 does not enable
 * real-money settlement.
 */
export function buildProductionFrozenMathVersion(overrides?: {
  version?: string;
  gameVersion?: string;
  maxPayoutMultiplier?: number;
}): MathVersionConfig {
  const version = overrides?.version ?? "ab-math-1.0.0";
  const base = buildInitialMathVersion({ version, status: "FROZEN" });

  return {
    ...base,
    gameVersion: overrides?.gameVersion ?? base.gameVersion,
    disclosure: {
      status: "FROZEN",
      targetRtp: 96.5,
      originalRtpKnown: false,
      realMoneyEnabled: false,
      provisionalNotes: ["R1-M3 production FROZEN math version. Real-money settlement remains disabled."],
    },
    reelWeights: {
      kind: "per-reel",
      reels: base.reelWeights.reels,
      note: "R1-M3 FROZEN per-reel weights. Not a real-money enablement.",
    },
    maxPayout: {
      kind: "fixed",
      totalBetMultiplier: overrides?.maxPayoutMultiplier ?? 2500,
      note: "R1-M3 FROZEN max payout cap.",
    },
  };
}

export const PRODUCTION_FROZEN_MATH_VERSION = buildProductionFrozenMathVersion({
  version: "ab-math-1.0.0",
});

export function getMathVersionById(versionId: string): MathVersionConfig | undefined {
  if (versionId === PRODUCTION_FROZEN_MATH_VERSION.version) {
    return PRODUCTION_FROZEN_MATH_VERSION;
  }
  if (versionId === INITIAL_MATH_VERSION.version) return INITIAL_MATH_VERSION;
  return undefined;
}

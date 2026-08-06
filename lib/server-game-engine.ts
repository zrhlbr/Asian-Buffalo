/**
 * Server-authoritative game engine for Asian Buffalo.
 *
 * All round results are generated on the server using a CSPRNG. The client may
 * only submit the bet configuration; any submitted symbol grid, win amount,
 * free-game count or multiplier is rejected by the API layer.
 *
 * In R1-M3-PRE this engine became fully config-driven: paylines, paytable,
 * scatter, wild, reel weights and room parameters are taken exclusively from
 * a loader-issued ExecutableMathVersion. Arbitrary MathVersionConfig objects
 * are rejected.
 */

import type { Grid, LineWin, SpinEvaluation } from "./game-engine.ts";
import type { MathVersionConfig, RegularSymbol, SymbolId } from "./math-config.ts";
import {
  assertExecutableMathVersion,
  MAX_SAFE_WEIGHT_TOTAL,
  type ExecutableMathVersion,
} from "./math-version-loader.ts";

export type ServerSpinEvaluation = SpinEvaluation & {
  rawTotalWin: number;
  finalTotalWin: number;
  capApplied: boolean;
};

export type ServerSpinOutcome = {
  grid: Grid;
  lineBetMinor: number;
  totalBetMinor: number;
  evaluation: ServerSpinEvaluation;
  winningPositions: { reel: number; row: number }[];
  mathVersion: string;
  generatedAt: string;
};

export class ServerGameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerGameError";
  }
}

/** Upper exclusive bound for Uint32 rejection sampling (2^32). */
export const RANDOM_INT_MAX_EXCLUSIVE = MAX_SAFE_WEIGHT_TOTAL;

/**
 * Generate a uniformly distributed integer in [0, maxExclusive).
 * Uses crypto.getRandomValues (Web Crypto CSPRNG) and rejection sampling
 * to avoid modulo bias. maxExclusive must be in 1..2^32 inclusive.
 */
export function randomInt(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError("maxExclusive must be a positive safe integer");
  }
  if (maxExclusive > RANDOM_INT_MAX_EXCLUSIVE) {
    throw new RangeError(
      `maxExclusive ${maxExclusive} exceeds Uint32 CSPRNG bound ${RANDOM_INT_MAX_EXCLUSIVE}`,
    );
  }
  const limit = Math.floor(RANDOM_INT_MAX_EXCLUSIVE / maxExclusive) * maxExclusive;
  if (limit <= 0) {
    throw new RangeError(`maxExclusive ${maxExclusive} cannot be sampled without bias`);
  }
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % maxExclusive;
}

function weightedPick(weights: { readonly [symbol: string]: number }): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new ServerGameError("Invalid reel weights: total must be a positive safe integer");
  }
  if (total > RANDOM_INT_MAX_EXCLUSIVE) {
    throw new ServerGameError(
      `Invalid reel weights: total ${total} exceeds CSPRNG-safe range ${RANDOM_INT_MAX_EXCLUSIVE}`,
    );
  }
  let cursor = randomInt(total);
  for (const [symbol, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return symbol;
  }
  return entries[entries.length - 1][0];
}

function generateServerGrid(mathConfig: ExecutableMathVersion): Grid {
  const { reelWeights } = mathConfig;
  if (reelWeights.kind !== "per-reel") {
    throw new ServerGameError("Only per-reel weights are supported in this engine");
  }
  if (reelWeights.reels.length !== mathConfig.grid.columns) {
    throw new ServerGameError(
      `Reel weights count ${reelWeights.reels.length} does not match grid columns ${mathConfig.grid.columns}`,
    );
  }

  return Array.from({ length: mathConfig.grid.columns }, (_, reelIndex) => {
    const weights = reelWeights.reels[reelIndex];
    return Array.from({ length: mathConfig.grid.rows }, () => weightedPick(weights) as SymbolId);
  });
}

function validateMathConfigForSpin(mathConfig: MathVersionConfig): void {
  const { columns, rows } = mathConfig.grid;
  if (columns <= 0 || rows <= 0) {
    throw new ServerGameError("Math config grid dimensions must be positive");
  }
  if (mathConfig.paylineCount !== mathConfig.paylines.length) {
    throw new ServerGameError(
      `Math config paylineCount ${mathConfig.paylineCount} does not match paylines.length ${mathConfig.paylines.length}`,
    );
  }
  mathConfig.paylines.forEach((line, index) => {
    if (line.length !== columns) {
      throw new ServerGameError(`Payline ${index} length ${line.length} != ${columns}`);
    }
    line.forEach((row, reel) => {
      if (row < 0 || row >= rows) {
        throw new ServerGameError(`Payline ${index} reel ${reel} row ${row} out of bounds`);
      }
    });
  });
  if (mathConfig.rooms.lineCount !== mathConfig.paylineCount) {
    throw new ServerGameError("Math config rooms.lineCount does not match paylineCount");
  }
}

function largestMatchingKey(
  map: { readonly [count: number]: number | undefined },
  count: number,
): number {
  let best = 0;
  Object.keys(map).forEach((key) => {
    const n = Number(key);
    if (Number.isSafeInteger(n) && n <= count && n > best) {
      best = n;
    }
  });
  return best;
}

function applyMaxPayoutCap(
  rawTotalWin: number,
  totalBet: number,
  mathConfig: ExecutableMathVersion,
): { finalTotalWin: number; capApplied: boolean } {
  const multiplier = mathConfig.maxPayout.totalBetMultiplier;
  if (!(multiplier > 0) || !Number.isFinite(multiplier)) {
    throw new ServerGameError("maxPayout.totalBetMultiplier must be a positive finite number");
  }
  const cap = totalBet * multiplier;
  if (!Number.isFinite(cap) || cap < 0) {
    throw new ServerGameError("max payout cap overflow");
  }
  if (rawTotalWin > cap) {
    return { finalTotalWin: cap, capApplied: true };
  }
  return { finalTotalWin: rawTotalWin, capApplied: false };
}

function evaluateSpinWithConfig(
  grid: Grid,
  totalBet: number,
  inFreeGames: boolean,
  mathConfig: ExecutableMathVersion,
): ServerSpinEvaluation {
  const { columns } = mathConfig.grid;
  if (grid.length !== columns || grid.some((reel) => reel.length !== mathConfig.grid.rows)) {
    throw new ServerGameError("Grid dimensions do not match math config");
  }

  const paylines = mathConfig.paylines;
  const lineBet = totalBet / paylines.length;
  const paytableBySymbol = new Map(mathConfig.paytable.map((entry) => [entry.symbol, entry.payouts]));
  const regularSymbols = new Set(mathConfig.paytable.map((entry) => entry.symbol));
  const lineWins: LineWin[] = [];

  paylines.forEach((rows, lineIndex) => {
    const first = grid[0][rows[0]];
    if (!regularSymbols.has(first as RegularSymbol)) return;
    const target = first as RegularSymbol;
    let count = 1;
    for (let reel = 1; reel < columns; reel += 1) {
      const symbol = grid[reel][rows[reel]];
      if (symbol === target || symbol === "wild") {
        count += 1;
      } else {
        break;
      }
    }
    const payouts = paytableBySymbol.get(target);
    const payoutMultiple = payouts?.[count as 2 | 3 | 4 | 5];
    if (payoutMultiple === undefined || payoutMultiple === null) return;
    lineWins.push({
      line: lineIndex + 1,
      symbol: target,
      count,
      payout: payoutMultiple * lineBet,
    });
  });

  const scatterCount = grid.flat().filter((symbol) => symbol === "scatter").length;
  const scatterMatch = largestMatchingKey(mathConfig.scatter.totalBetMultipliers, scatterCount);
  const scatterWin = scatterMatch > 0 ? (mathConfig.scatter.totalBetMultipliers[scatterMatch] ?? 0) * totalBet : 0;

  const lineWin = lineWins.reduce((sum, win) => sum + win.payout, 0);

  const wildReelIndexes = new Set(mathConfig.wild.appearsOnReelIndexes);
  const hasWild = grid.some(
    (reel, reelIndex) => wildReelIndexes.has(reelIndex) && reel.includes("wild"),
  );
  const multiplier =
    inFreeGames && hasWild && lineWin > 0
      ? (mathConfig.wild.freeGameMultiplier.values[
          randomInt(mathConfig.wild.freeGameMultiplier.values.length)
        ] as 2 | 3)
      : 1;

  const rawTotalWin = lineWin * multiplier + scatterWin;
  const { finalTotalWin, capApplied } = applyMaxPayoutCap(rawTotalWin, totalBet, mathConfig);

  const awardedFreeGames = inFreeGames
    ? scatterCount >= 2
      ? (mathConfig.scatter.retriggerFreeGames[
          largestMatchingKey(mathConfig.scatter.retriggerFreeGames, Math.min(scatterCount, columns)) as 2 | 3 | 4 | 5
        ] ?? 0)
      : 0
    : scatterCount >= 3
      ? (mathConfig.scatter.baseFreeGames[
          largestMatchingKey(mathConfig.scatter.baseFreeGames, Math.min(scatterCount, columns)) as 3 | 4 | 5
        ] ?? 0)
      : 0;

  return {
    lineWins,
    lineWin,
    scatterCount,
    scatterWin,
    multiplier,
    totalWin: finalTotalWin,
    rawTotalWin,
    finalTotalWin,
    capApplied,
    awardedFreeGames,
  };
}

function computeWinningPositions(
  grid: Grid,
  evaluation: SpinEvaluation,
  mathConfig: ExecutableMathVersion,
): { reel: number; row: number }[] {
  const positions = new Set<string>();
  evaluation.lineWins.forEach((win) => {
    const line = mathConfig.paylines[win.line - 1];
    for (let reel = 0; reel < win.count; reel += 1) {
      positions.add(`${reel}-${line[reel]}`);
    }
  });

  grid.forEach((reel, reelIndex) => {
    reel.forEach((symbol, rowIndex) => {
      if (symbol === "scatter") {
        positions.add(`${reelIndex}-${rowIndex}`);
      }
    });
  });

  return Array.from(positions).map((key) => {
    const [reel, row] = key.split("-").map(Number);
    return { reel, row };
  });
}

function requireExecutable(mathConfig: MathVersionConfig): ExecutableMathVersion {
  assertExecutableMathVersion(mathConfig);
  return mathConfig;
}

function validateFixedGridSymbols(grid: Grid, mathConfig: ExecutableMathVersion): void {
  const knownSymbols = new Set(mathConfig.symbols.map((symbol) => symbol.id));
  const wildReels = new Set(mathConfig.wild.appearsOnReelIndexes);
  const scatterReels = new Set(mathConfig.scatter.appearsOnReelIndexes);

  grid.forEach((reel, reelIndex) => {
    reel.forEach((symbol, rowIndex) => {
      if (!knownSymbols.has(symbol)) {
        throw new ServerGameError(
          `Unknown symbol ${String(symbol)} at reel ${reelIndex} row ${rowIndex}`,
        );
      }
      if (symbol === "wild" && !wildReels.has(reelIndex)) {
        throw new ServerGameError(`WILD not allowed on reel ${reelIndex}`);
      }
      if (symbol === "scatter" && !scatterReels.has(reelIndex)) {
        throw new ServerGameError(`SCATTER not allowed on reel ${reelIndex}`);
      }
    });
  });
}

/**
 * Generate a server-authoritative spin outcome.
 *
 * totalBetMinor must be an integer number of minor currency units and must be
 * evenly divisible by the number of paylines so that lineBetMinor is also an
 * integer.
 */
export function generateServerSpinOutcome(
  mathConfig: ExecutableMathVersion,
  totalBetMinor: number,
  inFreeGames: boolean,
): ServerSpinOutcome {
  if (!Number.isSafeInteger(totalBetMinor) || totalBetMinor < 0) {
    throw new ServerGameError("totalBetMinor must be a non-negative safe integer");
  }
  if (totalBetMinor % mathConfig.paylineCount !== 0) {
    throw new ServerGameError(
      `totalBetMinor ${totalBetMinor} is not divisible by ${mathConfig.paylineCount}`,
    );
  }

  const executable = requireExecutable(mathConfig);
  validateMathConfigForSpin(executable);

  const grid = generateServerGrid(executable);
  const evaluation = evaluateSpinWithConfig(grid, totalBetMinor, inFreeGames, executable);
  const winningPositions = computeWinningPositions(grid, evaluation, executable);

  return {
    grid,
    lineBetMinor: totalBetMinor / executable.paylineCount,
    totalBetMinor,
    evaluation,
    winningPositions,
    mathVersion: executable.version,
    generatedAt: new Date().toISOString(),
  };
}

export type FixedOutcomeInput = {
  grid: Grid;
  totalBetMinor: number;
  inFreeGames: boolean;
  mathConfig: ExecutableMathVersion;
};

/**
 * Evaluate a fixed grid on the server. Used for deterministic tests and
 * dispute replay only — never as a production SpinRequest field.
 */
export function evaluateFixedGrid(input: FixedOutcomeInput): ServerSpinOutcome {
  const { grid, totalBetMinor, inFreeGames, mathConfig } = input;

  if (grid.length !== mathConfig.grid.columns || grid.some((reel) => reel.length !== mathConfig.grid.rows)) {
    throw new ServerGameError("Invalid grid dimensions");
  }
  if (!Number.isSafeInteger(totalBetMinor) || totalBetMinor < 0) {
    throw new ServerGameError("totalBetMinor must be a non-negative safe integer");
  }
  if (totalBetMinor % mathConfig.paylineCount !== 0) {
    throw new ServerGameError(
      `totalBetMinor ${totalBetMinor} is not divisible by ${mathConfig.paylineCount}`,
    );
  }

  const executable = requireExecutable(mathConfig);
  validateMathConfigForSpin(executable);
  validateFixedGridSymbols(grid, executable);

  const evaluation = evaluateSpinWithConfig(grid, totalBetMinor, inFreeGames, executable);
  const winningPositions = computeWinningPositions(grid, evaluation, executable);

  return {
    grid,
    lineBetMinor: totalBetMinor / executable.paylineCount,
    totalBetMinor,
    evaluation,
    winningPositions,
    mathVersion: executable.version,
    generatedAt: new Date().toISOString(),
  };
}

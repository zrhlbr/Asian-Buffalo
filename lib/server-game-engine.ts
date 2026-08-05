/**
 * Server-authoritative game engine for Asian Buffalo.
 *
 * All round results are generated on the server using a CSPRNG. The client may
 * only submit the bet configuration; any submitted symbol grid, win amount,
 * free-game count or multiplier is rejected by the API layer.
 */

import {
  GRID_COLUMNS,
  GRID_ROWS,
  PAYLINE_COUNT,
  PAYLINES,
  type SymbolId,
} from "./game-config.ts";
import { evaluateSpin, type Grid, type SpinEvaluation } from "./game-engine.ts";
import type { MathVersionConfig } from "./math-config.ts";

export type ServerSpinOutcome = {
  grid: Grid;
  lineBetMinor: number;
  totalBetMinor: number;
  evaluation: SpinEvaluation;
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

/**
 * Generate a uniformly distributed integer in [0, maxExclusive).
 * Uses crypto.getRandomValues (Web Crypto CSPRNG) and rejection sampling
 * to avoid modulo bias.
 */
export function randomInt(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError("maxExclusive must be a positive safe integer");
  }
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
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
  let cursor = randomInt(total);
  for (const [symbol, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return symbol;
  }
  return entries[entries.length - 1][0];
}

function generateServerGrid(mathConfig: MathVersionConfig): Grid {
  const { reelWeights } = mathConfig;
  if (reelWeights.kind !== "per-reel") {
    throw new ServerGameError("Only per-reel weights are supported in this engine");
  }
  if (reelWeights.reels.length !== GRID_COLUMNS) {
    throw new ServerGameError(
      `Reel weights count ${reelWeights.reels.length} does not match grid columns ${GRID_COLUMNS}`,
    );
  }

  return Array.from({ length: GRID_COLUMNS }, (_, reelIndex) => {
    const weights = reelWeights.reels[reelIndex];
    return Array.from({ length: GRID_ROWS }, () => weightedPick(weights) as SymbolId);
  });
}

function validateMathConfigForSpin(mathConfig: MathVersionConfig): void {
  if (mathConfig.grid.columns !== GRID_COLUMNS || mathConfig.grid.rows !== GRID_ROWS) {
    throw new ServerGameError("Math config grid dimensions do not match engine");
  }
  if (mathConfig.paylineCount !== PAYLINE_COUNT) {
    throw new ServerGameError("Math config payline count does not match engine");
  }
  if (mathConfig.paylines.length !== PAYLINE_COUNT) {
    throw new ServerGameError("Math config payline map length does not match paylineCount");
  }
  mathConfig.paylines.forEach((line, index) => {
    if (line.length !== GRID_COLUMNS) {
      throw new ServerGameError(`Payline ${index} length ${line.length} != ${GRID_COLUMNS}`);
    }
    line.forEach((row, reel) => {
      if (row < 0 || row >= GRID_ROWS) {
        throw new ServerGameError(`Payline ${index} reel ${reel} row ${row} out of bounds`);
      }
    });
  });
}

function computeWinningPositions(grid: Grid, evaluation: SpinEvaluation): { reel: number; row: number }[] {
  const positions = new Set<string>();
  evaluation.lineWins.forEach((win) => {
    const line = PAYLINES[win.line - 1];
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

/**
 * Generate a server-authoritative spin outcome.
 *
 * totalBetMinor must be an integer number of minor currency units and must be
 * evenly divisible by the number of paylines so that lineBetMinor is also an
 * integer.
 */
export function generateServerSpinOutcome(
  mathConfig: MathVersionConfig,
  totalBetMinor: number,
  inFreeGames: boolean,
): ServerSpinOutcome {
  if (!Number.isSafeInteger(totalBetMinor) || totalBetMinor < 0) {
    throw new ServerGameError("totalBetMinor must be a non-negative safe integer");
  }
  if (totalBetMinor % PAYLINE_COUNT !== 0) {
    throw new ServerGameError(
      `totalBetMinor ${totalBetMinor} is not divisible by ${PAYLINE_COUNT}`,
    );
  }

  validateMathConfigForSpin(mathConfig);

  const grid = generateServerGrid(mathConfig);
  const evaluation = evaluateSpin(grid, totalBetMinor, inFreeGames);
  const winningPositions = computeWinningPositions(grid, evaluation);

  return {
    grid,
    lineBetMinor: totalBetMinor / PAYLINE_COUNT,
    totalBetMinor,
    evaluation,
    winningPositions,
    mathVersion: mathConfig.version,
    generatedAt: new Date().toISOString(),
  };
}

export type FixedOutcomeInput = {
  grid: Grid;
  totalBetMinor: number;
  inFreeGames: boolean;
  mathConfig: MathVersionConfig;
};

/**
 * Evaluate a fixed grid on the server. Used for deterministic tests and
 * dispute replay. The grid is still validated against the math config and the
 * engine never trusts client-submitted win values.
 */
export function evaluateFixedGrid(input: FixedOutcomeInput): ServerSpinOutcome {
  const { grid, totalBetMinor, inFreeGames, mathConfig } = input;

  if (grid.length !== GRID_COLUMNS || grid.some((reel) => reel.length !== GRID_ROWS)) {
    throw new ServerGameError("Invalid grid dimensions");
  }
  if (!Number.isSafeInteger(totalBetMinor) || totalBetMinor < 0) {
    throw new ServerGameError("totalBetMinor must be a non-negative safe integer");
  }
  if (totalBetMinor % PAYLINE_COUNT !== 0) {
    throw new ServerGameError(
      `totalBetMinor ${totalBetMinor} is not divisible by ${PAYLINE_COUNT}`,
    );
  }

  validateMathConfigForSpin(mathConfig);

  const evaluation = evaluateSpin(grid, totalBetMinor, inFreeGames);
  const winningPositions = computeWinningPositions(grid, evaluation);

  return {
    grid,
    lineBetMinor: totalBetMinor / PAYLINE_COUNT,
    totalBetMinor,
    evaluation,
    winningPositions,
    mathVersion: mathConfig.version,
    generatedAt: new Date().toISOString(),
  };
}

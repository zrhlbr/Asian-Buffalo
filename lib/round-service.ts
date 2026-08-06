/**
 * Round service orchestrates a single game round from bet reservation to
 * outcome generation and payout settlement.
 *
 * It is server-authoritative: the client may only supply the bet configuration
 * (room, level, multiplier) and an idempotency key. Any attempt to submit a
 * symbol grid, win amount, free-game count or multiplier is rejected before
 * the round is processed.
 */

import {
  generateServerSpinOutcome,
  evaluateFixedGrid,
  type ServerSpinOutcome,
} from "./server-game-engine.ts";
import type { Grid } from "./game-engine.ts";
import {
  ROOM_BASE_BETS,
  BET_LEVELS,
  BET_MULTIPLIERS,
  PAYLINE_COUNT,
} from "./game-config.ts";
import {
  validateRealMoneyAllowed,
  type MathVersionConfig,
} from "./math-config.ts";
import type { ExecutableMathVersion } from "./math-version-loader.ts";
import type { WalletAdapter } from "./wallet-adapter.ts";
import type { RoundStore } from "./round-store.ts";

export type SpinRequest = {
  sessionId: string;
  playerId: string;
  currency: string;
  roomBase: number;
  betLevel: number;
  betMultiplier: number;
  idempotencyKey: string;
  isFreeGame: boolean;
  freeGamesRemainingBefore: number;
};

export type SpinResult = {
  roundId: string;
  sessionId: string;
  playerId: string;
  mathVersion: string;
  idempotencyKey: string;
  currency: string;
  totalBetMinor: number;
  totalWinMinor: number;
  balanceAfterMinor: number;
  isFreeGame: boolean;
  freeGamesRemaining: number;
  awardedFreeGames: number;
  grid: string[][];
  winningPositions: { reel: number; row: number }[];
  lineWins: { line: number; symbol: string; count: number; payout: number }[];
  scatterCount: number;
  scatterWin: number;
  multiplier: number;
  settledAt: string;
};

export class RoundValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoundValidationError";
  }
}

/** Validate public bet parameters before any round claim is created. */
export function validateBetConfiguration(
  input: {
    roomBase: number;
    betLevel: number;
    betMultiplier: number;
    idempotencyKey: string;
  },
  mathConfig: MathVersionConfig,
): { totalBetMinor: number } {
  if (!ROOM_BASE_BETS.includes(input.roomBase as 50 | 500)) {
    throw new RoundValidationError(`Invalid room base bet: ${input.roomBase}`);
  }
  if (!BET_LEVELS.includes(input.betLevel as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)) {
    throw new RoundValidationError(`Invalid bet level: ${input.betLevel}`);
  }
  if (!BET_MULTIPLIERS.includes(input.betMultiplier as 1 | 5 | 10 | 20 | 50)) {
    throw new RoundValidationError(`Invalid bet multiplier: ${input.betMultiplier}`);
  }
  if (!input.idempotencyKey || input.idempotencyKey.length > 128) {
    throw new RoundValidationError("Idempotency key is required and must be <= 128 characters");
  }

  const totalBetMinor = input.roomBase * input.betLevel * input.betMultiplier;
  if (!Number.isSafeInteger(totalBetMinor) || totalBetMinor < 0) {
    throw new RoundValidationError("totalBetMinor overflow or negative");
  }
  if (totalBetMinor % PAYLINE_COUNT !== 0) {
    throw new RoundValidationError(
      `totalBetMinor ${totalBetMinor} is not divisible by ${PAYLINE_COUNT}`,
    );
  }
  if (mathConfig.rooms.baseBets.length !== ROOM_BASE_BETS.length) {
    throw new RoundValidationError("Math config room mismatch");
  }
  return { totalBetMinor };
}

function validateSpinRequest(
  request: SpinRequest,
  mathConfig: MathVersionConfig,
): { totalBetMinor: number; chargeMinor: number } {
  const { totalBetMinor } = validateBetConfiguration(request, mathConfig);

  if (request.isFreeGame) {
    if (request.freeGamesRemainingBefore <= 0) {
      throw new RoundValidationError("Free-game spin requires remaining free games > 0");
    }
  } else if (totalBetMinor === 0) {
    throw new RoundValidationError("Base-game spin must have totalBetMinor > 0");
  }

  // Free games use the triggering bet amount for line/scatter evaluation but
  // charge zero stake.
  const chargeMinor = request.isFreeGame ? 0 : totalBetMinor;
  return { totalBetMinor, chargeMinor };
}

/**
 * Generate a server outcome without touching the wallet.
 * fixedGrid is a test/dispute-replay entry only — never a production request field.
 */
export function generateSpinOutcomeOnly(
  mathConfig: ExecutableMathVersion,
  totalBetMinor: number,
  isFreeGame: boolean,
  fixedGrid?: string[][],
): ServerSpinOutcome {
  return fixedGrid
    ? evaluateFixedGrid({
        grid: fixedGrid as Grid,
        totalBetMinor,
        inFreeGames: isFreeGame,
        mathConfig,
      })
    : generateServerSpinOutcome(mathConfig, totalBetMinor, isFreeGame);
}

export function buildSpinResultSkeleton(input: {
  roundId: string;
  request: SpinRequest;
  mathVersion: string;
  totalBetMinor: number;
  outcome: ServerSpinOutcome;
  freeGamesRemaining: number;
}): Omit<SpinResult, "balanceAfterMinor" | "settledAt"> {
  return {
    roundId: input.roundId,
    sessionId: input.request.sessionId,
    playerId: input.request.playerId,
    mathVersion: input.mathVersion,
    idempotencyKey: input.request.idempotencyKey,
    currency: input.request.currency,
    totalBetMinor: input.totalBetMinor,
    totalWinMinor: input.outcome.evaluation.totalWin,
    isFreeGame: input.request.isFreeGame,
    freeGamesRemaining: input.freeGamesRemaining,
    awardedFreeGames: input.outcome.evaluation.awardedFreeGames,
    grid: input.outcome.grid,
    winningPositions: input.outcome.winningPositions,
    lineWins: input.outcome.evaluation.lineWins,
    scatterCount: input.outcome.evaluation.scatterCount,
    scatterWin: input.outcome.evaluation.scatterWin,
    multiplier: input.outcome.evaluation.multiplier,
  };
}

function rejectClientOutcomeFields(payload: Record<string, unknown>): void {
  const forbidden = [
    "grid",
    "fixedGrid",
    "symbols",
    "winscore",
    "winScore",
    "totalWin",
    "freeGames",
    "awardedFreeGames",
    "multiplier",
    "fMultiple",
    "userscore",
    "userScore",
    "balanceAfter",
  ];
  const found = forbidden.filter((key) => key in payload);
  if (found.length > 0) {
    throw new RoundValidationError(
      `Client-submitted outcome fields are not allowed: ${found.join(", ")}`,
    );
  }
}

export type RoundServiceDeps = {
  walletAdapter: WalletAdapter;
  roundStore: RoundStore;
  mathConfig: ExecutableMathVersion;
  /** Set to true only in non-production, math-prototype environments. */
  allowRealMoney: boolean;
  /** Test/dispute replay only — never populated from a public SpinRequest. */
  testFixedGrid?: string[][];
};

/**
 * Process a spin request. This is the server-authoritative entry point.
 *
 * The function intentionally accepts only the bet configuration; any client
 * outcome data must be rejected by the caller before this function is invoked.
 */
export async function processSpin(
  deps: RoundServiceDeps,
  request: SpinRequest,
  rawPayloadForValidation?: Record<string, unknown>,
): Promise<SpinResult> {
  if (rawPayloadForValidation) {
    rejectClientOutcomeFields(rawPayloadForValidation);
  }

  if (deps.allowRealMoney) {
    validateRealMoneyAllowed(deps.mathConfig);
  }

  const { totalBetMinor, chargeMinor } = validateSpinRequest(request, deps.mathConfig);

  const cached = await deps.roundStore.getByIdempotencyKey(
    request.playerId,
    request.idempotencyKey,
  );
  if (cached) {
    return cached;
  }

  const outcome: ServerSpinOutcome = generateSpinOutcomeOnly(
    deps.mathConfig,
    totalBetMinor,
    request.isFreeGame,
    deps.testFixedGrid,
  );

  const settlement = await deps.walletAdapter.settleRound({
    idempotencyKey: request.idempotencyKey,
    playerId: request.playerId,
    currency: request.currency,
    betMinor: chargeMinor,
    winMinor: outcome.evaluation.totalWin,
    isFreeGame: request.isFreeGame,
  });

  const freeGamesRemaining = Math.max(
    0,
    request.isFreeGame ? request.freeGamesRemainingBefore - 1 : request.freeGamesRemainingBefore,
  );

  const result: SpinResult = {
    roundId: `${request.sessionId}:${request.idempotencyKey}`,
    sessionId: request.sessionId,
    playerId: request.playerId,
    mathVersion: deps.mathConfig.version,
    idempotencyKey: request.idempotencyKey,
    currency: request.currency,
    totalBetMinor,
    totalWinMinor: outcome.evaluation.totalWin,
    balanceAfterMinor: settlement.playerBalanceAfterMinor,
    isFreeGame: request.isFreeGame,
    freeGamesRemaining,
    awardedFreeGames: outcome.evaluation.awardedFreeGames,
    grid: outcome.grid,
    winningPositions: outcome.winningPositions,
    lineWins: outcome.evaluation.lineWins,
    scatterCount: outcome.evaluation.scatterCount,
    scatterWin: outcome.evaluation.scatterWin,
    multiplier: outcome.evaluation.multiplier,
    settledAt: settlement.postedAt,
  };

  await deps.roundStore.saveRound(result);
  return result;
}

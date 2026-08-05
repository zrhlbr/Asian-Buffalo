/**
 * API handler logic for the game endpoints.
 *
 * These functions are decoupled from the Next.js request/response objects so
 * they can be unit-tested with mocked dependencies. Route files are thin
 * wrappers that wire them to `getDb()` and the runtime environment.
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema.ts";
import { createSession, getRound, getRoundByIdempotency, saveRound, seedInitialMathVersion } from "./db-game.ts";
import { INITIAL_MATH_VERSION, getMathVersionById } from "./math-config.ts";
import { processSpin, type SpinRequest, RoundValidationError } from "./round-service.ts";
import type { WalletAdapter } from "./wallet-adapter.ts";
import type { RoundStore } from "./round-store.ts";

export type ApiError = {
  error: {
    code: string;
    message: string;
  };
};

export function apiError(code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status: 400 });
}

export function apiServerError(message: string): Response {
  return Response.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
}

export type GameServices = {
  walletAdapter: WalletAdapter;
  roundStore: RoundStore;
  allowRealMoney: boolean;
};

export async function handleCreateSession(
  db: DrizzleD1Database<typeof schema>,
  payload: unknown,
): Promise<Response> {
  if (!payload || typeof payload !== "object") {
    return apiError("INVALID_REQUEST", "Request body must be an object");
  }
  const { playerId, currency, mathVersionId } = payload as Record<string, unknown>;
  if (typeof playerId !== "string" || playerId.length === 0) {
    return apiError("INVALID_REQUEST", "playerId is required");
  }
  if (typeof currency !== "string" || currency.length !== 3) {
    return apiError("INVALID_REQUEST", "currency must be a 3-letter code");
  }
  if (typeof mathVersionId !== "string" || !getMathVersionById(mathVersionId)) {
    return apiError("INVALID_REQUEST", "Unknown math version");
  }

  await seedInitialMathVersion(db);
  const session = await createSession(db, {
    playerId,
    currency,
    mathVersionId,
  });

  return Response.json({ sessionId: session.id, mathVersionId, expiresAt: session.expiresAt });
}

export async function handleSpin(
  db: DrizzleD1Database<typeof schema>,
  services: GameServices,
  payload: unknown,
): Promise<Response> {
  if (!payload || typeof payload !== "object") {
    return apiError("INVALID_REQUEST", "Request body must be an object");
  }

  const forbiddenFields = [
    "grid",
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
  const found = forbiddenFields.filter((key) => key in (payload as object));
  if (found.length > 0) {
    return apiError(
      "CLIENT_OUTCOME_REJECTED",
      `Client-submitted outcome fields are not allowed: ${found.join(", ")}`,
    );
  }

  const p = payload as Record<string, unknown>;
  const spinRequest: SpinRequest = {
    sessionId: String(p.sessionId ?? ""),
    playerId: String(p.playerId ?? ""),
    currency: String(p.currency ?? ""),
    roomBase: Number(p.roomBase ?? 0),
    betLevel: Number(p.betLevel ?? 0),
    betMultiplier: Number(p.betMultiplier ?? 0),
    idempotencyKey: String(p.idempotencyKey ?? ""),
    isFreeGame: Boolean(p.isFreeGame ?? false),
    freeGamesRemainingBefore: Number(p.freeGamesRemainingBefore ?? 0),
  };

  // Idempotency: if the round already exists in the database, return it.
  const existing = await getRoundByIdempotency(db, spinRequest.playerId, spinRequest.idempotencyKey);
  if (existing) {
    return Response.json(existing);
  }

  await seedInitialMathVersion(db);

  try {
    const result = await processSpin(
      {
        walletAdapter: services.walletAdapter,
        roundStore: services.roundStore,
        mathConfig: INITIAL_MATH_VERSION,
        allowRealMoney: services.allowRealMoney,
      },
      spinRequest,
    );

    await saveRound(db, result, JSON.stringify(payload));
    return Response.json(result);
  } catch (error) {
    if (error instanceof RoundValidationError) {
      return apiError("VALIDATION_ERROR", error.message);
    }
    if (error instanceof Error && error.name === "InsufficientBalanceError") {
      return apiError("INSUFFICIENT_BALANCE", error.message);
    }
    if (error instanceof Error && error.name === "RealMoneyBlockedError") {
      return apiError("REAL_MONEY_BLOCKED", error.message);
    }
    return apiServerError(error instanceof Error ? error.message : "Unknown error");
  }
}

export async function handleGetRound(
  db: DrizzleD1Database<typeof schema>,
  roundId: string,
): Promise<Response> {
  const result = await getRound(db, roundId);
  if (!result) {
    return apiError("ROUND_NOT_FOUND", `Round ${roundId} not found`);
  }
  return Response.json(result);
}

export async function handleGetRules(
  _db: DrizzleD1Database<typeof schema>,
  mathVersionId: string,
): Promise<Response> {
  const config = getMathVersionById(mathVersionId);
  if (!config) {
    return apiError("RULES_NOT_FOUND", `Math version ${mathVersionId} not found`);
  }
  return Response.json(config);
}

/**
 * API handler logic for the game endpoints.
 *
 * These functions are decoupled from the Next.js request/response objects so
 * they can be unit-tested with mocked dependencies. Route files are thin
 * wrappers that wire them to `getDb()` and the runtime environment.
 *
 * Identity must be supplied via explicit dependency injection. There is no
 * default identity provider; production routes must inject the fail-closed
 * production provider until formal authentication is wired.
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema.ts";
import {
  createSession,
  getAuthorizedRound,
  getTrustedPlayerContext,
  getRoundByIdempotency,
  saveRound,
  seedInitialMathVersion,
} from "./db-game.ts";
import {
  createProductionIdentityProvider,
  IdentityAuthError,
  IdentityUnavailableError,
  type IdentityProvider,
} from "./identity.ts";
import { INITIAL_MATH_VERSION, getMathVersionById } from "./math-config.ts";
import { processSpin, type SpinRequest, RoundValidationError } from "./round-service.ts";
import type { WalletAdapter } from "./wallet-adapter.ts";
import type { RoundStore } from "./round-store.ts";

/** Re-export for production routes so they do not add a separate identity.ts import. */
export { createProductionIdentityProvider };

export type ApiError = {
  error: {
    code: string;
    message: string;
  };
};

export function apiError(code: string, message: string, status = 400): Response {
  return Response.json({ error: { code, message } }, { status });
}

export function apiUnauthorized(): Response {
  return Response.json(
    { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
    { status: 401 },
  );
}

export function apiForbiddenPlayerUnavailable(): Response {
  return Response.json(
    { error: { code: "PLAYER_UNAVAILABLE", message: "Player unavailable" } },
    { status: 403 },
  );
}

export function apiServiceUnavailable(): Response {
  return Response.json(
    { error: { code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable" } },
    { status: 503 },
  );
}

export function apiServerError(message: string): Response {
  return Response.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
}

export type GameServices = {
  walletAdapter: WalletAdapter;
  roundStore: RoundStore;
  allowRealMoney: boolean;
};

export type HandlerAuth = {
  identityProvider: IdentityProvider;
  request: Request;
};

const CLIENT_IDENTITY_BODY_FIELDS = ["playerId", "currency"] as const;
const STRICT_CURRENCY = /^[A-Z]{3}$/;

function rejectClientIdentityFields(payload: Record<string, unknown>): Response | null {
  const found = CLIENT_IDENTITY_BODY_FIELDS.filter((key) => key in payload);
  if (found.length > 0) {
    return apiError(
      "CLIENT_IDENTITY_REJECTED",
      "Client-submitted identity fields are not allowed",
    );
  }
  return null;
}

async function resolveAuthenticatedPlayer(auth: HandlerAuth) {
  try {
    return await auth.identityProvider.resolve(auth.request);
  } catch (error) {
    if (error instanceof IdentityUnavailableError) {
      return { errorResponse: apiServiceUnavailable() } as const;
    }
    if (error instanceof IdentityAuthError) {
      return { errorResponse: apiUnauthorized() } as const;
    }
    throw error;
  }
}

/**
 * Load and gate a trusted ACTIVE player with a strict DB currency value.
 * Missing players stay on the established generic not-found response.
 * LOCKED/CLOSED map to a generic 403 that does not reveal account state.
 * Invalid currency is a server-data fault and returns a generic 503.
 */
async function requireTrustedActivePlayer(
  db: DrizzleD1Database<typeof schema>,
  playerId: string,
): Promise<{ playerId: string; currency: string } | { errorResponse: Response }> {
  const context = await getTrustedPlayerContext(db, playerId);
  if (!context) {
    return {
      errorResponse: apiError("PLAYER_NOT_FOUND", "Player not found", 404),
    };
  }
  if (context.status !== "ACTIVE") {
    return { errorResponse: apiForbiddenPlayerUnavailable() };
  }
  if (typeof context.currency !== "string" || !STRICT_CURRENCY.test(context.currency)) {
    return { errorResponse: apiServiceUnavailable() };
  }
  return { playerId: context.playerId, currency: context.currency };
}

export async function handleCreateSession(
  db: DrizzleD1Database<typeof schema>,
  auth: HandlerAuth,
  payload: unknown,
): Promise<Response> {
  const resolved = await resolveAuthenticatedPlayer(auth);
  if ("errorResponse" in resolved) return resolved.errorResponse;
  const { playerId } = resolved;

  // Player gate before any request-body / business validation.
  const playerResult = await requireTrustedActivePlayer(db, playerId);
  if ("errorResponse" in playerResult) return playerResult.errorResponse;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return apiError("INVALID_REQUEST", "Request body must be an object");
  }
  const body = payload as Record<string, unknown>;
  const identityRejection = rejectClientIdentityFields(body);
  if (identityRejection) return identityRejection;

  const { mathVersionId } = body;
  if (typeof mathVersionId !== "string" || !getMathVersionById(mathVersionId)) {
    return apiError("INVALID_REQUEST", "Unknown math version");
  }

  await seedInitialMathVersion(db);
  const session = await createSession(db, {
    playerId,
    mathVersionId,
  });

  return Response.json({
    sessionId: session.id,
    mathVersionId,
    expiresAt: session.expiresAt,
  });
}

export async function handleSpin(
  db: DrizzleD1Database<typeof schema>,
  auth: HandlerAuth,
  services: GameServices,
  payload: unknown,
): Promise<Response> {
  const resolved = await resolveAuthenticatedPlayer(auth);
  if ("errorResponse" in resolved) return resolved.errorResponse;
  const { playerId } = resolved;

  // Player gate before any request-body / business validation.
  const playerResult = await requireTrustedActivePlayer(db, playerId);
  if ("errorResponse" in playerResult) return playerResult.errorResponse;
  const { currency } = playerResult;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return apiError("INVALID_REQUEST", "Request body must be an object");
  }

  const body = payload as Record<string, unknown>;
  const identityRejection = rejectClientIdentityFields(body);
  if (identityRejection) return identityRejection;

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
  const found = forbiddenFields.filter((key) => key in body);
  if (found.length > 0) {
    return apiError(
      "CLIENT_OUTCOME_REJECTED",
      `Client-submitted outcome fields are not allowed: ${found.join(", ")}`,
    );
  }

  const spinRequest: SpinRequest = {
    sessionId: String(body.sessionId ?? ""),
    playerId,
    currency,
    roomBase: Number(body.roomBase ?? 0),
    betLevel: Number(body.betLevel ?? 0),
    betMultiplier: Number(body.betMultiplier ?? 0),
    idempotencyKey: String(body.idempotencyKey ?? ""),
    isFreeGame: Boolean(body.isFreeGame ?? false),
    freeGamesRemainingBefore: Number(body.freeGamesRemainingBefore ?? 0),
  };

  // Idempotency: if the round already exists in the database, return it.
  const existing = await getRoundByIdempotency(db, playerId, spinRequest.idempotencyKey);
  if (existing) {
    if (existing.playerId !== playerId) {
      return apiError("ROUND_NOT_FOUND", "Round not found", 404);
    }
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
  auth: HandlerAuth,
  roundId: string,
): Promise<Response> {
  const resolved = await resolveAuthenticatedPlayer(auth);
  if ("errorResponse" in resolved) return resolved.errorResponse;
  const { playerId } = resolved;

  const playerResult = await requireTrustedActivePlayer(db, playerId);
  if ("errorResponse" in playerResult) return playerResult.errorResponse;

  const lookup = await getAuthorizedRound(db, roundId, playerId);
  if (lookup.kind === "not_found") {
    return apiError("ROUND_NOT_FOUND", "Round not found", 404);
  }
  if (lookup.kind === "integrity_error") {
    return apiServerError("Service error");
  }
  return Response.json(lookup.result);
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

/**
 * API handler logic for the game endpoints.
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
  getSessionForPlayer,
  getTrustedPlayerContext,
  listMathVersionRows,
  loadExecutableMathVersionById,
  seedProductionFrozenMathVersion,
} from "./db-game.ts";
import { systemClock, type Clock } from "./clock.ts";
import {
  createProductionIdentityProvider,
  IdentityAuthError,
  IdentityUnavailableError,
  type IdentityProvider,
} from "./identity.ts";
import type { ExecutableMathVersion } from "./math-version-loader.ts";
import {
  MathVersionIntegrityError,
  MathVersionUnavailableError,
  MathVersionValidationError,
  selectMathVersion,
} from "./math-version-loader.ts";
import {
  validateCreateSessionRequest,
  validateSpinRequest,
} from "./api-schemas.ts";
import { ValidationError } from "./validation.ts";
import { canonicalizeSpinRequest, hashSpinRequest } from "./request-hash.ts";
import {
  orchestrateSpin,
  type SpinFaultHooks,
  type SpinOrchestratorServices,
} from "./spin-orchestrator.ts";
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
  /**
   * Loader-issued executable math required for spin outcome generation.
   * Formal M3 must wire selectMathVersion; omitted config fails closed.
   */
  mathConfig?: ExecutableMathVersion;
  clock?: Clock;
  /** Test-only fixed grid injection. Never accepted from public requests. */
  testFixedGrid?: string[][];
  /** Test-only fault injection hooks for crash-recovery coverage. */
  faults?: SpinFaultHooks;
};

export type HandlerAuth = {
  identityProvider: IdentityProvider;
  request: Request;
};

const STRICT_CURRENCY = /^[A-Z]{3}$/;

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

function validationErrorResponse(error: ValidationError): Response {
  return apiError("INVALID_REQUEST", error.message);
}

export async function handleCreateSession(
  db: DrizzleD1Database<typeof schema>,
  auth: HandlerAuth,
  payload: unknown,
  clock: Clock = systemClock,
): Promise<Response> {
  const resolved = await resolveAuthenticatedPlayer(auth);
  if ("errorResponse" in resolved) return resolved.errorResponse;
  const { playerId } = resolved;

  const playerResult = await requireTrustedActivePlayer(db, playerId);
  if ("errorResponse" in playerResult) return playerResult.errorResponse;
  const { currency } = playerResult;

  try {
    validateCreateSessionRequest(payload);
  } catch (error) {
    if (error instanceof ValidationError) return validationErrorResponse(error);
    throw error;
  }

  try {
    await seedProductionFrozenMathVersion(db);
    const selected = await selectMathVersion(await listMathVersionRows(db));
    const session = await createSession(
      db,
      {
        playerId,
        mathVersionId: selected.version,
        currency,
      },
      clock,
    );

    return Response.json({
      sessionId: session.id,
      mathVersionId: selected.version,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    if (error instanceof MathVersionUnavailableError) {
      return apiError("MATH_VERSION_UNAVAILABLE", error.message, 503);
    }
    if (
      error instanceof MathVersionValidationError ||
      error instanceof MathVersionIntegrityError
    ) {
      return apiError("MATH_VERSION_UNAVAILABLE", error.message, 503);
    }
    throw error;
  }
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

  const playerResult = await requireTrustedActivePlayer(db, playerId);
  if ("errorResponse" in playerResult) return playerResult.errorResponse;

  let publicSpin;
  try {
    publicSpin = validateSpinRequest(payload);
  } catch (error) {
    if (error instanceof ValidationError) return validationErrorResponse(error);
    throw error;
  }

  const canonicalPayload = canonicalizeSpinRequest(publicSpin);
  const requestHash = await hashSpinRequest(publicSpin);

  let mathConfig = services.mathConfig;
  if (!mathConfig) {
    try {
      await seedProductionFrozenMathVersion(db);
      const session = await getSessionForPlayer(db, publicSpin.sessionId, playerId);
      if (!session) {
        return apiError("SESSION_NOT_FOUND", "Session not found", 404);
      }
      mathConfig = await loadExecutableMathVersionById(db, session.mathVersionId);
    } catch (error) {
      if (error instanceof MathVersionUnavailableError) {
        return apiError("MATH_VERSION_UNAVAILABLE", error.message, 503);
      }
      if (
        error instanceof MathVersionValidationError ||
        error instanceof MathVersionIntegrityError
      ) {
        return apiError("MATH_VERSION_UNAVAILABLE", error.message, 503);
      }
      throw error;
    }
  }

  const orchServices: SpinOrchestratorServices = {
    walletAdapter: services.walletAdapter,
    roundStore: services.roundStore,
    allowRealMoney: services.allowRealMoney,
    mathConfig,
    clock: services.clock,
    testFixedGrid: services.testFixedGrid,
    faults: services.faults,
  };

  const outcome = await orchestrateSpin(db, orchServices, {
    playerId,
    playerCurrency: playerResult.currency,
    publicSpin,
    requestHash,
    canonicalPayload,
  });

  switch (outcome.kind) {
    case "ok":
    case "idempotent":
      return Response.json(outcome.result);
    case "conflict":
      return apiError(
        "IDEMPOTENCY_CONFLICT",
        "Idempotency key was reused with a different request",
        409,
      );
    case "in_progress":
      return apiError(
        "IDEMPOTENCY_IN_PROGRESS",
        "A matching request is still processing",
        409,
      );
    case "session_not_found":
      return apiError("SESSION_NOT_FOUND", "Session not found", 404);
    case "session_unavailable":
      return apiError("SESSION_UNAVAILABLE", "Session unavailable", 403);
    case "session_currency_mismatch":
      return apiError(
        "SESSION_CURRENCY_MISMATCH",
        "Session currency no longer matches player wallet currency",
        409,
      );
    case "validation":
      return apiError("VALIDATION_ERROR", outcome.message);
    case "insufficient_balance":
      return apiError("INSUFFICIENT_BALANCE", outcome.message);
    case "real_money_blocked":
      return apiError("REAL_MONEY_BLOCKED", outcome.message);
    case "math_version_mismatch":
      return apiError("MATH_VERSION_MISMATCH", outcome.message, 500);
    case "error":
      return apiServerError(outcome.message);
    default:
      return apiServerError("Unknown spin orchestration result");
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
  db: DrizzleD1Database<typeof schema>,
  mathVersionId: string,
): Promise<Response> {
  try {
    await seedProductionFrozenMathVersion(db);
    const config = await loadExecutableMathVersionById(db, mathVersionId);
    return Response.json(config);
  } catch (error) {
    if (
      error instanceof MathVersionUnavailableError ||
      error instanceof MathVersionValidationError ||
      error instanceof MathVersionIntegrityError
    ) {
      return apiError("RULES_NOT_FOUND", `Math version ${mathVersionId} not found`);
    }
    throw error;
  }
}

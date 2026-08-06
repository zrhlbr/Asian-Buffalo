/**
 * D1-backed persistence helpers for game sessions and rounds.
 *
 * These functions write to the Drizzle schema tables. The wallet/ledger layer
 * still uses the test adapter in this batch; production real-money wallet
 * integration is a future milestone.
 */

import { eq, and, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema.ts";
import type { Clock } from "./clock.ts";
import { systemClock } from "./clock.ts";
import type { SpinResult } from "./round-service.ts";
import { INITIAL_MATH_VERSION } from "./math-config.ts";

export type CreateSessionInput = {
  playerId: string;
  mathVersionId: string;
  currency: string;
  expiresInSeconds?: number;
};

export type PlayerStatus = "ACTIVE" | "LOCKED" | "CLOSED";

/** Trusted player row fields used by protected handlers. */
export type TrustedPlayerContext = {
  playerId: string;
  currency: string;
  status: PlayerStatus;
};

export type AuthorizedRoundResult =
  | { kind: "not_found" }
  | { kind: "integrity_error" }
  | { kind: "ok"; result: SpinResult };

export type DbSession = {
  id: string;
  playerId: string;
  mathVersionId: string;
  status: "OPEN" | "CLOSED" | "REVOKED";
  currency: string;
  freeGamesRemaining: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type IdempotencyRecord = {
  requestHash: string;
  status: "PENDING" | "SETTLED" | "VOID";
  result?: SpinResult;
  round?: typeof schema.gameRounds.$inferSelect;
};

export function generateId(prefix: string): string {
  const random = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}_${random}`;
}

/**
 * Load trusted player context from the players table.
 * Returns undefined when the player row is missing.
 */
export async function getTrustedPlayerContext(
  db: DrizzleD1Database<typeof schema>,
  playerId: string,
): Promise<TrustedPlayerContext | undefined> {
  const row = await db.query.players.findFirst({
    where: eq(schema.players.id, playerId),
  });
  if (!row) return undefined;
  return {
    playerId: row.id,
    currency: row.currency,
    status: row.status as PlayerStatus,
  };
}

export async function createSession(
  db: DrizzleD1Database<typeof schema>,
  input: CreateSessionInput,
  clock: Clock = systemClock,
): Promise<DbSession> {
  const id = generateId("sess");
  const expiresAt = new Date(
    clock.now().getTime() + (input.expiresInSeconds ?? 3600) * 1000,
  ).toISOString();

  await db.insert(schema.gameSessions).values({
    id,
    playerId: input.playerId,
    mathVersionId: input.mathVersionId,
    status: "OPEN",
    currency: input.currency,
    freeGamesRemaining: 0,
    expiresAt,
  });

  const row = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, id),
  });
  if (!row) throw new Error("Session insert failed");
  return row as DbSession;
}

/** Locate a session by id and authenticated player. Prevents cross-player enumeration. */
export async function getSessionForPlayer(
  db: DrizzleD1Database<typeof schema>,
  sessionId: string,
  playerId: string,
): Promise<DbSession | undefined> {
  const row = await db.query.gameSessions.findFirst({
    where: and(
      eq(schema.gameSessions.id, sessionId),
      eq(schema.gameSessions.playerId, playerId),
    ),
  });
  return row as DbSession | undefined;
}

export function isSessionExpired(session: DbSession, clock: Clock = systemClock): boolean {
  return clock.now().getTime() >= Date.parse(session.expiresAt);
}

/**
 * Conditionally consume one free game via compare-and-set on the remaining count.
 * Concurrent callers cannot both succeed when remaining === 1.
 */
export async function tryConsumeFreeGame(
  db: DrizzleD1Database<typeof schema>,
  sessionId: string,
  playerId: string,
  clock: Clock = systemClock,
): Promise<boolean> {
  const current = await getSessionForPlayer(db, sessionId, playerId);
  if (!current || current.status !== "OPEN" || current.freeGamesRemaining <= 0) {
    return false;
  }

  const updated = await db
    .update(schema.gameSessions)
    .set({
      freeGamesRemaining: current.freeGamesRemaining - 1,
      updatedAt: clock.now().toISOString(),
    })
    .where(
      and(
        eq(schema.gameSessions.id, sessionId),
        eq(schema.gameSessions.playerId, playerId),
        eq(schema.gameSessions.status, "OPEN"),
        eq(schema.gameSessions.freeGamesRemaining, current.freeGamesRemaining),
      ),
    )
    .returning({ id: schema.gameSessions.id });
  return updated.length > 0;
}

/** Credit awarded free games back onto the session (always non-negative via CHECK). */
export async function creditFreeGames(
  db: DrizzleD1Database<typeof schema>,
  sessionId: string,
  playerId: string,
  amount: number,
  clock: Clock = systemClock,
): Promise<void> {
  if (!Number.isSafeInteger(amount) || amount <= 0) return;
  await db
    .update(schema.gameSessions)
    .set({
      freeGamesRemaining: sql`${schema.gameSessions.freeGamesRemaining} + ${amount}`,
      updatedAt: clock.now().toISOString(),
    })
    .where(
      and(
        eq(schema.gameSessions.id, sessionId),
        eq(schema.gameSessions.playerId, playerId),
      ),
    );
}

export type ClaimRoundInput = {
  playerId: string;
  sessionId: string;
  mathVersionId: string;
  idempotencyKey: string;
  requestHash: string;
  requestPayload: string;
  currency: string;
  totalBetMinor: number;
};

export type ClaimRoundResult =
  | { kind: "claimed"; roundId: string }
  | { kind: "exists"; record: IdempotencyRecord };

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message: unknown }).message) : "";
  const code = "code" in error ? String((error as { code: unknown }).code) : "";
  return (
    code === "SQLITE_CONSTRAINT_UNIQUE" ||
    /UNIQUE constraint failed/i.test(message) ||
    /constraint failed/i.test(message)
  );
}

async function loadIdempotencyRecord(
  db: DrizzleD1Database<typeof schema>,
  playerId: string,
  idempotencyKey: string,
): Promise<IdempotencyRecord | undefined> {
  const row = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, playerId),
      eq(schema.gameRounds.idempotencyKey, idempotencyKey),
    ),
  });
  if (!row) return undefined;

  if (row.status === "SETTLED" && row.outcomeJson) {
    const authorized = await getAuthorizedRound(db, row.id, playerId);
    if (authorized.kind === "ok") {
      return {
        requestHash: row.requestHash,
        status: "SETTLED",
        result: authorized.result,
      };
    }
  }

  return {
    requestHash: row.requestHash,
    status: row.status as IdempotencyRecord["status"],
  };
}

/** Atomically claim the (playerId, idempotencyKey) slot with a PENDING round. */
export async function claimRoundSlot(
  db: DrizzleD1Database<typeof schema>,
  input: ClaimRoundInput,
): Promise<ClaimRoundResult> {
  const existing = await loadIdempotencyRecord(db, input.playerId, input.idempotencyKey);
  if (existing) {
    return { kind: "exists", record: existing };
  }

  const roundId = generateId("round");
  try {
    await db.insert(schema.gameRounds).values({
      id: roundId,
      sessionId: input.sessionId,
      playerId: input.playerId,
      mathVersionId: input.mathVersionId,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      requestPayload: input.requestPayload,
      status: "PENDING",
      currency: input.currency,
      totalBetMinor: input.totalBetMinor,
      isFreeGame: false,
    });
    return { kind: "claimed", roundId };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await loadIdempotencyRecord(db, input.playerId, input.idempotencyKey);
    if (!raced) throw error;
    return { kind: "exists", record: raced };
  }
}

export async function settleClaimedRound(
  db: DrizzleD1Database<typeof schema>,
  roundId: string,
  result: SpinResult,
  clock: Clock = systemClock,
): Promise<void> {
  await db
    .update(schema.gameRounds)
    .set({
      status: "SETTLED",
      totalWinMinor: result.totalWinMinor,
      balanceAfterMinor: result.balanceAfterMinor,
      isFreeGame: result.isFreeGame,
      outcomeJson: JSON.stringify(result),
      resultHash: await sha256Hex(JSON.stringify(result)),
      settledAt: result.settledAt ?? clock.now().toISOString(),
    })
    .where(eq(schema.gameRounds.id, roundId));
}

export async function voidClaimedRound(
  db: DrizzleD1Database<typeof schema>,
  roundId: string,
): Promise<void> {
  await db
    .update(schema.gameRounds)
    .set({
      status: "VOID",
      outcomeJson: null,
    })
    .where(eq(schema.gameRounds.id, roundId));
}

export async function waitForSettledIdempotency(
  db: DrizzleD1Database<typeof schema>,
  playerId: string,
  idempotencyKey: string,
  attempts = 20,
): Promise<IdempotencyRecord | undefined> {
  for (let i = 0; i < attempts; i += 1) {
    const record = await loadIdempotencyRecord(db, playerId, idempotencyKey);
    if (!record) return undefined;
    if (record.status === "SETTLED" && record.result) return record;
    if (record.status === "VOID") return record;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return loadIdempotencyRecord(db, playerId, idempotencyKey);
}

/**
 * Authorize round access using database columns only:
 *   WHERE id = roundId AND player_id = authenticatedPlayerId
 * outcome_json is parsed only after that authorization succeeds.
 */
export async function getAuthorizedRound(
  db: DrizzleD1Database<typeof schema>,
  roundId: string,
  authenticatedPlayerId: string,
): Promise<AuthorizedRoundResult> {
  const row = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.id, roundId),
      eq(schema.gameRounds.playerId, authenticatedPlayerId),
    ),
  });
  if (!row || row.outcomeJson == null) {
    return { kind: "not_found" };
  }

  let parsedUnknown: unknown;
  try {
    parsedUnknown = JSON.parse(row.outcomeJson) as unknown;
  } catch {
    console.error("round_outcome_integrity_error", {
      roundId,
      reason: "outcome_json_parse_failed",
    });
    return { kind: "integrity_error" };
  }

  if (
    parsedUnknown === null ||
    typeof parsedUnknown !== "object" ||
    Array.isArray(parsedUnknown) ||
    typeof (parsedUnknown as { playerId?: unknown }).playerId !== "string"
  ) {
    console.error("round_outcome_integrity_error", {
      roundId,
      reason: "outcome_json_invalid_shape",
    });
    return { kind: "integrity_error" };
  }

  const parsed = parsedUnknown as SpinResult;
  if (parsed.playerId !== row.playerId) {
    console.error("round_outcome_integrity_error", {
      roundId,
      reason: "outcome_player_mismatch",
    });
    return { kind: "integrity_error" };
  }

  return { kind: "ok", result: parsed };
}

export async function getRoundByIdempotency(
  db: DrizzleD1Database<typeof schema>,
  playerId: string,
  idempotencyKey: string,
): Promise<SpinResult | undefined> {
  const record = await loadIdempotencyRecord(db, playerId, idempotencyKey);
  return record?.result;
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function seedInitialMathVersion(
  db: DrizzleD1Database<typeof schema>,
): Promise<void> {
  const { hashMathVersionConfig } = await import("./math-config.ts");
  const config = INITIAL_MATH_VERSION;
  const existing = await db.query.gameMathVersions.findFirst({
    where: eq(schema.gameMathVersions.id, config.version),
  });
  if (existing) return;

  await db.insert(schema.gameMathVersions).values({
    id: config.version,
    sha256: await hashMathVersionConfig(config),
    status: config.status,
    configJson: JSON.stringify(config),
  });
}

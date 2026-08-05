/**
 * D1-backed persistence helpers for game sessions and rounds.
 *
 * These functions write to the Drizzle schema tables. The wallet/ledger layer
 * still uses the test adapter in this batch; production real-money wallet
 * integration is a future milestone.
 */

import { eq, and } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema.ts";
import type { SpinResult } from "./round-service.ts";
import { INITIAL_MATH_VERSION } from "./math-config.ts";

export type CreateSessionInput = {
  playerId: string;
  currency: string;
  mathVersionId: string;
  expiresInSeconds?: number;
};

export type DbSession = {
  id: string;
  playerId: string;
  mathVersionId: string;
  status: "OPEN" | "CLOSED" | "REVOKED";
  freeGamesRemaining: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export function generateId(prefix: string): string {
  const random = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}_${random}`;
}

export async function createSession(
  db: DrizzleD1Database<typeof schema>,
  input: CreateSessionInput,
): Promise<DbSession> {
  const id = generateId("sess");
  const expiresAt = new Date(
    Date.now() + (input.expiresInSeconds ?? 3600) * 1000,
  ).toISOString();

  await db.insert(schema.gameSessions).values({
    id,
    playerId: input.playerId,
    mathVersionId: input.mathVersionId,
    status: "OPEN",
    freeGamesRemaining: 0,
    expiresAt,
  });

  const row = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, id),
  });
  if (!row) throw new Error("Session insert failed");
  return row as DbSession;
}

export async function getSession(
  db: DrizzleD1Database<typeof schema>,
  sessionId: string,
): Promise<DbSession | undefined> {
  const row = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, sessionId),
  });
  return row as DbSession | undefined;
}

export async function saveRound(
  db: DrizzleD1Database<typeof schema>,
  result: SpinResult,
  requestPayload: string,
): Promise<void> {
  await db.insert(schema.gameRounds).values({
    id: result.roundId,
    sessionId: result.sessionId,
    playerId: result.playerId,
    mathVersionId: result.mathVersion,
    idempotencyKey: result.idempotencyKey,
    requestHash: await sha256Hex(requestPayload),
    requestPayload,
    resultHash: await sha256Hex(JSON.stringify(result)),
    status: "SETTLED",
    currency: result.currency,
    totalBetMinor: result.totalBetMinor,
    totalWinMinor: result.totalWinMinor,
    balanceAfterMinor: result.balanceAfterMinor,
    isFreeGame: result.isFreeGame,
    outcomeJson: JSON.stringify(result),
    settledAt: result.settledAt,
  });
}

export async function getRound(
  db: DrizzleD1Database<typeof schema>,
  roundId: string,
): Promise<SpinResult | undefined> {
  const row = await db.query.gameRounds.findFirst({
    where: eq(schema.gameRounds.id, roundId),
  });
  if (!row || !row.outcomeJson) return undefined;
  return JSON.parse(row.outcomeJson) as SpinResult;
}

export async function getRoundByIdempotency(
  db: DrizzleD1Database<typeof schema>,
  playerId: string,
  idempotencyKey: string,
): Promise<SpinResult | undefined> {
  const row = await db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, playerId),
      eq(schema.gameRounds.idempotencyKey, idempotencyKey),
    ),
  });
  if (!row || !row.outcomeJson) return undefined;
  return JSON.parse(row.outcomeJson) as SpinResult;
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

/**
 * Crash-safe spin orchestration with lease fencing and atomic reservations.
 *
 * After auth/ACTIVE/schema/hash (caller):
 * 1) Idempotency lookup (SETTLED survives session changes)
 * 2) Bet validation (no PENDING on 400)
 * 3) Atomic TX: session gates + free-game CAS + UNIQUE round claim
 * 4) Persist outcome (fenced) before wallet
 * 5) Wallet settle — clear reject vs unknown outcome
 * 6) Atomic free-game award + RoundStore + SETTLED (all fenced)
 */

import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema.ts";
import type { Clock } from "./clock.ts";
import { systemClock } from "./clock.ts";
import {
  atomicAbortStatement,
  runAtomicBatch,
  type AtomicDb,
  type AtomicStatement,
} from "./db-atomic.ts";
import {
  generateId,
  getAuthorizedRound,
  getSessionForPlayer,
  type DbSession,
  type IdempotencyRecord,
} from "./db-game.ts";
import { validateRealMoneyAllowed } from "./math-config.ts";
import {
  assertExecutableMathVersion,
  MathVersionMismatchError,
  type ExecutableMathVersion,
} from "./math-version-loader.ts";

export { MathVersionMismatchError };
import {
  buildSpinResultSkeleton,
  generateSpinOutcomeOnly,
  validateBetConfiguration,
  type SpinRequest,
  type SpinResult,
  RoundValidationError,
} from "./round-service.ts";
import type { PublicSpinRequest } from "./api-schemas.ts";
import {
  isClearWalletRejection,
  type WalletAdapter,
  WalletResultUnknownError,
} from "./wallet-adapter.ts";
import type { RoundStore } from "./round-store.ts";

export const LEASE_TTL_MS = 30_000;
/** Lease extension while a wallet call may be in flight. */
export const WALLET_LEASE_TTL_MS = 120_000;

export class LeaseFencedError extends Error {
  constructor(message = "Lease claim token no longer owns this PENDING round") {
    super(message);
    this.name = "LeaseFencedError";
  }
}

export type SpinFaultHooks = {
  afterOutcomePersist?: () => Promise<void> | void;
  afterWallet?: () => Promise<void> | void;
  afterFreeGameAward?: () => Promise<void> | void;
  beforeRoundStoreSave?: () => Promise<void> | void;
  beforeFinalize?: () => Promise<void> | void;
  /**
   * Inject abort after free-game reservation statement and before Round INSERT
   * inside the atomic claim batch (full batch rolls back).
   */
  afterFreeReserveBeforeClaim?: boolean;
  /**
   * Inject abort between session credit and free_games_awarded mark
   * inside the atomic award batch (full batch rolls back).
   */
  betweenAwardSteps?: boolean;
  /**
   * Inject abort between fenced free-game restore and Round DELETE
   * inside the atomic release batch (full batch rolls back).
   */
  betweenRestoreAndDelete?: boolean;
};

export type SpinOrchestratorServices = {
  walletAdapter: WalletAdapter;
  roundStore: RoundStore;
  allowRealMoney: boolean;
  /**
   * Loader-issued executable math. Required for outcome generation.
   * Formal M3 must wire selectMathVersion; missing config fails closed.
   */
  mathConfig?: ExecutableMathVersion;
  clock?: Clock;
  testFixedGrid?: string[][];
  faults?: SpinFaultHooks;
};

function requireExecutableMath(services: SpinOrchestratorServices): ExecutableMathVersion {
  if (!services.mathConfig) {
    throw new Error("Executable math version is not configured");
  }
  assertExecutableMathVersion(services.mathConfig);
  return services.mathConfig;
}

/** Fail closed when a persisted id does not match the executable in use. */
export function assertPersistedMathVersionMatch(
  persistedVersionId: string,
  mathConfig: ExecutableMathVersion,
  source: "session" | "round",
  sourceId: string,
): void {
  if (persistedVersionId !== mathConfig.version) {
    throw new MathVersionMismatchError(
      `math version mismatch: ${source} ${sourceId} has ${persistedVersionId}, executable is ${mathConfig.version}`,
    );
  }
}

export type SessionExpiryState = "open" | "unavailable" | "invalid_expiry";

export function sessionExpiryState(
  session: DbSession,
  clock: Clock = systemClock,
): SessionExpiryState {
  const expiresMs = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresMs)) return "invalid_expiry";
  if (clock.now().getTime() >= expiresMs) return "unavailable";
  return "open";
}

/** Unparseable / missing lease expiry is treated as expired (never forever-valid). */
export function isLeaseExpired(
  leaseExpiresAt: string | null | undefined,
  nowMs: number,
): boolean {
  if (leaseExpiresAt == null || leaseExpiresAt === "") return true;
  const ms = Date.parse(leaseExpiresAt);
  if (!Number.isFinite(ms)) return true;
  return ms <= nowMs;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message: unknown }).message) : "";
  const code = "code" in error ? String((error as { code: unknown }).code) : "";
  return (
    code === "SQLITE_CONSTRAINT_UNIQUE" ||
    /UNIQUE constraint failed/i.test(message)
  );
}

export type RoundRow = typeof schema.gameRounds.$inferSelect;
type Db = DrizzleD1Database<typeof schema>;

export async function loadRoundByIdempotency(
  db: Db,
  playerId: string,
  idempotencyKey: string,
): Promise<RoundRow | undefined> {
  return db.query.gameRounds.findFirst({
    where: and(
      eq(schema.gameRounds.playerId, playerId),
      eq(schema.gameRounds.idempotencyKey, idempotencyKey),
    ),
  });
}

export async function toIdempotencyRecord(
  db: Db,
  row: RoundRow,
  playerId: string,
): Promise<IdempotencyRecord> {
  if (row.status === "SETTLED" && row.outcomeJson) {
    const authorized = await getAuthorizedRound(db, row.id, playerId);
    if (authorized.kind === "ok") {
      return {
        requestHash: row.requestHash,
        status: "SETTLED",
        result: authorized.result,
        round: row,
      };
    }
  }
  return {
    requestHash: row.requestHash,
    status: row.status as IdempotencyRecord["status"],
    round: row,
  };
}

function pendingTokenWhere(roundId: string, claimToken: string) {
  return and(
    eq(schema.gameRounds.id, roundId),
    eq(schema.gameRounds.status, "PENDING"),
    eq(schema.gameRounds.claimToken, claimToken),
  );
}

async function requireFencedUpdate(
  updated: { id: string }[],
  context: string,
): Promise<void> {
  if (updated.length === 0) {
    throw new LeaseFencedError(`Fenced write failed: ${context}`);
  }
}

export async function renewLease(
  db: Db,
  roundId: string,
  claimToken: string,
  nowIso: string,
  leaseExpiresAt: string,
): Promise<void> {
  const updated = await db
    .update(schema.gameRounds)
    .set({
      leaseExpiresAt,
      updatedAt: nowIso,
    })
    .where(pendingTokenWhere(roundId, claimToken))
    .returning({ id: schema.gameRounds.id });
  await requireFencedUpdate(updated, "renewLease");
}

export async function takeOverStalePending(
  db: Db,
  row: RoundRow,
  claimToken: string,
  leaseExpiresAt: string,
  nowIso: string,
  nowMs: number,
): Promise<boolean> {
  if (!isLeaseExpired(row.leaseExpiresAt, nowMs)) {
    return false;
  }
  // CAS on the complete observed lease state. A stale reader must not steal
  // ownership after the current worker has renewed the same claim token.
  const updated = await db
    .update(schema.gameRounds)
    .set({
      claimToken,
      leaseExpiresAt,
      updatedAt: nowIso,
    })
    .where(
      and(
        eq(schema.gameRounds.id, row.id),
        eq(schema.gameRounds.status, "PENDING"),
        row.claimToken == null
          ? sql`${schema.gameRounds.claimToken} IS NULL`
          : eq(schema.gameRounds.claimToken, row.claimToken),
        row.leaseExpiresAt == null
          ? sql`${schema.gameRounds.leaseExpiresAt} IS NULL`
          : eq(schema.gameRounds.leaseExpiresAt, row.leaseExpiresAt),
        row.updatedAt == null
          ? sql`${schema.gameRounds.updatedAt} IS NULL`
          : eq(schema.gameRounds.updatedAt, row.updatedAt),
      ),
    )
    .returning({ id: schema.gameRounds.id });
  return updated.length > 0;
}

/**
 * Atomically restore one reserved free game and delete the PENDING round.
 * All predicates are evaluated inside the batch — lost leases cannot restore.
 */
export async function releaseRejectedRoundAtomic(
  db: Db,
  input: {
    roundId: string;
    sessionId: string;
    playerId: string;
    claimToken: string;
    nowIso: string;
    faults?: SpinFaultHooks;
  },
): Promise<{ restored: boolean; deleted: boolean }> {
  const restoreStmt: AtomicStatement = {
    sql: `UPDATE game_sessions
           SET free_games_remaining = free_games_remaining + 1,
               updated_at = ?
           WHERE id = ?
             AND player_id = ?
             AND EXISTS (
               SELECT 1 FROM game_rounds
               WHERE id = ?
                 AND status = 'PENDING'
                 AND claim_token = ?
                 AND wallet_applied = 0
                 AND free_game_reserved = 1
             )`,
    params: [
      input.nowIso,
      input.sessionId,
      input.playerId,
      input.roundId,
      input.claimToken,
    ],
  };
  const deleteStmt: AtomicStatement = {
    sql: `DELETE FROM game_rounds
          WHERE id = ?
            AND status = 'PENDING'
            AND claim_token = ?
            AND wallet_applied = 0`,
    params: [input.roundId, input.claimToken],
  };

  const statements: AtomicStatement[] = input.faults?.betweenRestoreAndDelete
    ? [restoreStmt, atomicAbortStatement(), deleteStmt]
    : [restoreStmt, deleteStmt];

  try {
    const { changes } = await runAtomicBatch(db as unknown as AtomicDb, statements);
    return {
      restored: (changes[0] ?? 0) > 0,
      deleted: (changes[changes.length - 1] ?? 0) > 0,
    };
  } catch (error) {
    if (input.faults?.betweenRestoreAndDelete) {
      throw new Error("fault between free-game restore and round delete");
    }
    throw error;
  }
}

/**
 * Atomically: UNIQUE round claim + session gates + free-game CAS reserve.
 * Uses D1 batch / better-sqlite3 native transaction — never D1 BEGIN/COMMIT.
 */
export async function claimRoundAndReserveSession(
  db: Db,
  input: {
    playerId: string;
    sessionId: string;
    playerCurrency: string;
    idempotencyKey: string;
    requestHash: string;
    requestPayload: string;
    totalBetMinor: number;
    claimToken: string;
    leaseExpiresAt: string;
    nowIso: string;
    faults?: SpinFaultHooks;
  },
): Promise<
  | {
      kind: "claimed";
      roundId: string;
      isFreeGame: boolean;
      freeGamesBefore: number;
      session: DbSession;
    }
  | { kind: "exists"; row: RoundRow }
  | { kind: "not_found" }
  | { kind: "unavailable" }
  | { kind: "invalid_expiry" }
  | { kind: "currency_mismatch" }
> {
  const existing = await loadRoundByIdempotency(
    db,
    input.playerId,
    input.idempotencyKey,
  );
  if (existing) return { kind: "exists", row: existing };

  const session = await getSessionForPlayer(db, input.sessionId, input.playerId);
  if (!session) return { kind: "not_found" };
  if (session.currency !== input.playerCurrency) return { kind: "currency_mismatch" };
  const expiry = sessionExpiryState(session, { now: () => new Date(input.nowIso) });
  if (expiry === "invalid_expiry") return { kind: "invalid_expiry" };
  if (expiry === "unavailable" || session.status !== "OPEN") return { kind: "unavailable" };

  const roundId = generateId("round");
  const freeGamesBefore = session.freeGamesRemaining;

  // Production atomic order: INSERT (captures free snapshot) then CAS decrement.
  // Fault path: decrement then abort — proves reserve+insert share one atomic unit.
  const insertStmt: AtomicStatement = {
    sql: `INSERT INTO game_rounds (
            id, session_id, player_id, math_version_id, idempotency_key, request_hash,
            request_payload, status, currency, total_bet_minor, is_free_game,
            free_game_reserved, free_games_awarded, wallet_applied, claim_token,
            lease_expires_at, updated_at
          )
          SELECT
            ?, s.id, s.player_id, s.math_version_id, ?, ?,
            ?, 'PENDING', s.currency, ?,
            CASE WHEN s.free_games_remaining > 0 THEN 1 ELSE 0 END,
            CASE WHEN s.free_games_remaining > 0 THEN 1 ELSE 0 END,
            0, 0, ?, ?, ?
          FROM game_sessions s
          WHERE s.id = ?
            AND s.player_id = ?
            AND s.status = 'OPEN'
            AND s.currency = ?
            AND length(s.expires_at) > 0
            AND s.expires_at > ?
            AND NOT EXISTS (
              SELECT 1 FROM game_rounds r
              WHERE r.player_id = ? AND r.idempotency_key = ?
            )`,
    params: [
      roundId,
      input.idempotencyKey,
      input.requestHash,
      input.requestPayload,
      input.totalBetMinor,
      input.claimToken,
      input.leaseExpiresAt,
      input.nowIso,
      input.sessionId,
      input.playerId,
      input.playerCurrency,
      input.nowIso,
      input.playerId,
      input.idempotencyKey,
    ],
  };

  const decrementStmt: AtomicStatement = {
    sql: `UPDATE game_sessions
          SET free_games_remaining = free_games_remaining - 1,
              updated_at = ?
          WHERE id = ?
            AND player_id = ?
            AND free_games_remaining > 0
            AND EXISTS (
              SELECT 1 FROM game_rounds
              WHERE id = ? AND free_game_reserved = 1
            )`,
    params: [input.nowIso, input.sessionId, input.playerId, roundId],
  };

  const statements: AtomicStatement[] = input.faults?.afterFreeReserveBeforeClaim
    ? [
        {
          sql: `UPDATE game_sessions
                SET free_games_remaining = free_games_remaining - 1,
                    updated_at = ?
                WHERE id = ?
                  AND player_id = ?
                  AND status = 'OPEN'
                  AND currency = ?
                  AND length(expires_at) > 0
                  AND expires_at > ?
                  AND free_games_remaining > 0
                  AND NOT EXISTS (
                    SELECT 1 FROM game_rounds r
                    WHERE r.player_id = ? AND r.idempotency_key = ?
                  )`,
          params: [
            input.nowIso,
            input.sessionId,
            input.playerId,
            input.playerCurrency,
            input.nowIso,
            input.playerId,
            input.idempotencyKey,
          ],
        },
        atomicAbortStatement(),
        insertStmt,
      ]
    : [insertStmt, decrementStmt];

  try {
    const { changes } = await runAtomicBatch(db as unknown as AtomicDb, statements);
    if (input.faults?.afterFreeReserveBeforeClaim) {
      // Abort statement always throws; if we got here something is wrong.
      throw new Error("expected atomic abort during claim fault injection");
    }
    if ((changes[0] ?? 0) === 0) {
      const raced = await loadRoundByIdempotency(
        db,
        input.playerId,
        input.idempotencyKey,
      );
      if (raced) return { kind: "exists", row: raced };
      return { kind: "unavailable" };
    }

    const row = (await loadRoundByIdempotency(
      db,
      input.playerId,
      input.idempotencyKey,
    ))!;
    const nextSession = (await getSessionForPlayer(db, input.sessionId, input.playerId))!;
    return {
      kind: "claimed",
      roundId: row.id,
      isFreeGame: row.isFreeGame || row.freeGameReserved,
      freeGamesBefore: row.freeGameReserved
        ? nextSession.freeGamesRemaining + 1
        : freeGamesBefore,
      session: nextSession,
    };
  } catch (error) {
    if (input.faults?.afterFreeReserveBeforeClaim) {
      // Batch aborted — reservation must not stick; surface as hard failure for tests.
      throw new Error("crash after free reserve before round insert");
    }
    if (isUniqueViolation(error)) {
      const raced = await loadRoundByIdempotency(
        db,
        input.playerId,
        input.idempotencyKey,
      );
      if (raced) return { kind: "exists", row: raced };
    }
    throw error;
  }
}

async function persistOutcomeReady(
  db: Db,
  roundId: string,
  claimToken: string,
  partial: Omit<SpinResult, "balanceAfterMinor" | "settledAt">,
  nowIso: string,
  leaseExpiresAt: string,
): Promise<void> {
  const updated = await db
    .update(schema.gameRounds)
    .set({
      outcomeJson: JSON.stringify(partial),
      totalWinMinor: partial.totalWinMinor,
      isFreeGame: partial.isFreeGame,
      freeGameReserved: partial.isFreeGame,
      updatedAt: nowIso,
      leaseExpiresAt,
    })
    .where(pendingTokenWhere(roundId, claimToken))
    .returning({ id: schema.gameRounds.id });
  await requireFencedUpdate(updated, "persistOutcomeReady");
}

async function markWalletApplied(
  db: Db,
  roundId: string,
  claimToken: string,
  result: SpinResult,
  nowIso: string,
  leaseExpiresAt: string,
): Promise<void> {
  const updated = await db
    .update(schema.gameRounds)
    .set({
      walletApplied: true,
      balanceAfterMinor: result.balanceAfterMinor,
      settledAt: result.settledAt,
      outcomeJson: JSON.stringify(result),
      updatedAt: nowIso,
      leaseExpiresAt,
    })
    .where(pendingTokenWhere(roundId, claimToken))
    .returning({ id: schema.gameRounds.id });
  await requireFencedUpdate(updated, "markWalletApplied");
}

export async function awardFreeGamesAtomic(
  db: Db,
  input: {
    roundId: string;
    claimToken: string;
    sessionId: string;
    playerId: string;
    amount: number;
    nowIso: string;
    leaseExpiresAt: string;
    faults?: SpinFaultHooks;
  },
): Promise<boolean> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) return false;

  const creditStmt: AtomicStatement = {
    sql: `UPDATE game_sessions
          SET free_games_remaining = free_games_remaining + ?,
              updated_at = ?
          WHERE id = ?
            AND player_id = ?
            AND EXISTS (
              SELECT 1 FROM game_rounds
              WHERE id = ?
                AND session_id = ?
                AND player_id = ?
                AND status = 'PENDING'
                AND claim_token = ?
                AND free_games_awarded = 0
            )`,
    params: [
      input.amount,
      input.nowIso,
      input.sessionId,
      input.playerId,
      input.roundId,
      input.sessionId,
      input.playerId,
      input.claimToken,
    ],
  };
  const markStmt: AtomicStatement = {
    sql: `UPDATE game_rounds
          SET free_games_awarded = ?,
              updated_at = ?,
              lease_expires_at = ?
          WHERE id = ?
            AND session_id = ?
            AND player_id = ?
            AND status = 'PENDING'
            AND claim_token = ?
            AND free_games_awarded = 0`,
    params: [
      input.amount,
      input.nowIso,
      input.leaseExpiresAt,
      input.roundId,
      input.sessionId,
      input.playerId,
      input.claimToken,
    ],
  };

  const statements: AtomicStatement[] = input.faults?.betweenAwardSteps
    ? [creditStmt, atomicAbortStatement(), markStmt]
    : [creditStmt, markStmt];

  try {
    const { changes } = await runAtomicBatch(db as unknown as AtomicDb, statements);
    return (changes[0] ?? 0) > 0 && (changes[changes.length - 1] ?? 0) > 0;
  } catch (error) {
    if (input.faults?.betweenAwardSteps) {
      throw new Error("db fail between award mark and credit");
    }
    throw error;
  }
}

async function finalizeSettled(
  db: Db,
  roundId: string,
  claimToken: string,
  result: SpinResult,
  nowIso: string,
): Promise<void> {
  const resultHash = await sha256Hex(JSON.stringify(result));
  const updated = await db
    .update(schema.gameRounds)
    .set({
      status: "SETTLED",
      outcomeJson: JSON.stringify(result),
      resultHash,
      totalWinMinor: result.totalWinMinor,
      balanceAfterMinor: result.balanceAfterMinor,
      settledAt: result.settledAt,
      updatedAt: nowIso,
      leaseExpiresAt: null,
    })
    .where(pendingTokenWhere(roundId, claimToken))
    .returning({ id: schema.gameRounds.id });
  await requireFencedUpdate(updated, "finalizeSettled");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type OrchestrateSpinResult =
  | { kind: "ok"; result: SpinResult }
  | { kind: "idempotent"; result: SpinResult }
  | { kind: "in_progress" }
  | { kind: "conflict" }
  | { kind: "session_not_found" }
  | { kind: "session_unavailable" }
  | { kind: "session_currency_mismatch" }
  | { kind: "validation"; message: string }
  | { kind: "insufficient_balance"; message: string }
  | { kind: "real_money_blocked"; message: string }
  | { kind: "math_version_mismatch"; message: string }
  | { kind: "error"; message: string };

function asMathVersionMismatchResult(error: unknown): OrchestrateSpinResult | null {
  if (error instanceof MathVersionMismatchError) {
    return { kind: "math_version_mismatch", message: error.message };
  }
  return null;
}

function mapSessionFailure(
  kind: "not_found" | "unavailable" | "invalid_expiry" | "currency_mismatch",
): OrchestrateSpinResult {
  if (kind === "not_found") return { kind: "session_not_found" };
  if (kind === "currency_mismatch") return { kind: "session_currency_mismatch" };
  return { kind: "session_unavailable" };
}

function parseStoredOutcome(row: RoundRow): SpinResult | undefined {
  if (!row.outcomeJson) return undefined;
  try {
    const parsed = JSON.parse(row.outcomeJson) as SpinResult;
    if (parsed && typeof parsed === "object" && parsed.playerId === row.playerId) {
      return parsed;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function releaseClearReject(
  db: Db,
  working: RoundRow,
  claimToken: string,
  nowIso: string,
  faults?: SpinFaultHooks,
): Promise<void> {
  await releaseRejectedRoundAtomic(db, {
    roundId: working.id,
    sessionId: working.sessionId,
    playerId: working.playerId,
    claimToken,
    nowIso,
    faults,
  });
}

async function completeFromPendingRow(
  db: Db,
  services: SpinOrchestratorServices,
  row: RoundRow,
  playerCurrency: string,
  claimToken: string,
): Promise<OrchestrateSpinResult> {
  const clock = services.clock ?? systemClock;
  let now = clock.now();
  let nowIso = now.toISOString();
  let leaseExpiresAt = new Date(now.getTime() + LEASE_TTL_MS).toISOString();

  const mathConfig = requireExecutableMath(services);

  // Bound check before outcome generation/restoration and before wallet settle.
  // Never rewrite round.math_version_id to paper over a mismatch.
  assertPersistedMathVersionMatch(
    row.mathVersionId,
    mathConfig,
    "round",
    row.id,
  );

  if (services.allowRealMoney) {
    try {
      validateRealMoneyAllowed(mathConfig);
    } catch (error) {
      if (error instanceof Error && error.name === "RealMoneyBlockedError") {
        return { kind: "real_money_blocked", message: error.message };
      }
      throw error;
    }
  }

  let working = row;
  if (working.claimToken !== claimToken) {
    throw new LeaseFencedError();
  }

  const storedOutcome = parseStoredOutcome(row);
  let partial: Omit<SpinResult, "balanceAfterMinor" | "settledAt">;

  if (!storedOutcome) {
    const session = await getSessionForPlayer(db, row.sessionId, row.playerId);
    if (!session) return { kind: "session_not_found" };
    const isFreeGame = working.freeGameReserved || working.isFreeGame;
    const freeGamesBefore = session.freeGamesRemaining + (isFreeGame ? 1 : 0);
    const payload = JSON.parse(row.requestPayload ?? "{}") as PublicSpinRequest;
    const request: SpinRequest = {
      sessionId: row.sessionId,
      playerId: row.playerId,
      currency: row.currency,
      roomBase: payload.roomBase,
      betLevel: payload.betLevel,
      betMultiplier: payload.betMultiplier,
      idempotencyKey: row.idempotencyKey,
      isFreeGame,
      freeGamesRemainingBefore: freeGamesBefore,
    };
    const outcome = generateSpinOutcomeOnly(
      mathConfig,
      row.totalBetMinor,
      isFreeGame,
      services.testFixedGrid,
    );
    partial = buildSpinResultSkeleton({
      roundId: row.id,
      request,
      mathVersion: mathConfig.version,
      totalBetMinor: row.totalBetMinor,
      outcome,
      freeGamesRemaining: Math.max(0, isFreeGame ? freeGamesBefore - 1 : freeGamesBefore),
    });
    await persistOutcomeReady(db, row.id, claimToken, partial, nowIso, leaseExpiresAt);
    working = (await loadRoundByIdempotency(db, row.playerId, row.idempotencyKey))!;
    if (services.faults?.afterOutcomePersist) {
      await services.faults.afterOutcomePersist();
    }
  } else {
    const { balanceAfterMinor: _balanceAfterMinor, settledAt: _settledAt, ...skeleton } =
      storedOutcome;
    void _balanceAfterMinor;
    void _settledAt;
    partial = skeleton;
  }

  const chargeMinor = working.isFreeGame || partial.isFreeGame ? 0 : partial.totalBetMinor;

  let result: SpinResult = {
    ...partial,
    balanceAfterMinor: working.balanceAfterMinor ?? 0,
    settledAt: working.settledAt ?? nowIso,
  };

  if (!working.walletApplied) {
    // Renew lease before potentially long wallet I/O.
    now = clock.now();
    nowIso = now.toISOString();
    leaseExpiresAt = new Date(now.getTime() + WALLET_LEASE_TTL_MS).toISOString();
    await renewLease(db, working.id, claimToken, nowIso, leaseExpiresAt);

    let walletCallStarted = false;
    try {
      walletCallStarted = true;
      const settlement = await services.walletAdapter.settleRound({
        idempotencyKey: working.idempotencyKey,
        playerId: working.playerId,
        currency: working.currency,
        betMinor: chargeMinor,
        winMinor: partial.totalWinMinor,
        isFreeGame: partial.isFreeGame,
      });
      result = {
        ...partial,
        balanceAfterMinor: settlement.playerBalanceAfterMinor,
        settledAt: settlement.postedAt,
      };
      now = clock.now();
      nowIso = now.toISOString();
      leaseExpiresAt = new Date(now.getTime() + LEASE_TTL_MS).toISOString();
      await markWalletApplied(db, working.id, claimToken, result, nowIso, leaseExpiresAt);
      working = (await loadRoundByIdempotency(db, working.playerId, working.idempotencyKey))!;
      if (services.faults?.afterWallet) {
        await services.faults.afterWallet();
      }
    } catch (error) {
      if (isClearWalletRejection(error)) {
        await releaseClearReject(db, working, claimToken, nowIso, services.faults);
        return {
          kind: "insufficient_balance",
          message: error instanceof Error ? error.message : "Insufficient balance",
        };
      }
      // Wallet call started: treat all other failures as unknown. Keep PENDING.
      if (walletCallStarted) {
        return {
          kind: "error",
          message:
            error instanceof WalletResultUnknownError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Wallet result unknown",
        };
      }
      throw error;
    }
  } else if (working.outcomeJson) {
    result = parseStoredOutcome(working) ?? result;
  }

  if (result.awardedFreeGames > 0 && (working.freeGamesAwarded ?? 0) === 0) {
    now = clock.now();
    nowIso = now.toISOString();
    leaseExpiresAt = new Date(now.getTime() + LEASE_TTL_MS).toISOString();
    await awardFreeGamesAtomic(db, {
      roundId: working.id,
      claimToken,
      sessionId: working.sessionId,
      playerId: working.playerId,
      amount: result.awardedFreeGames,
      nowIso,
      leaseExpiresAt,
      faults: services.faults,
    });
    working = (await loadRoundByIdempotency(db, working.playerId, working.idempotencyKey))!;
    if (services.faults?.afterFreeGameAward) {
      await services.faults.afterFreeGameAward();
    }
  }

  const refreshed = await getSessionForPlayer(db, working.sessionId, working.playerId);
  result.freeGamesRemaining = refreshed?.freeGamesRemaining ?? result.freeGamesRemaining;

  if (services.faults?.beforeRoundStoreSave) {
    await services.faults.beforeRoundStoreSave();
  }
  // Fenced touch before external RoundStore publish.
  now = clock.now();
  nowIso = now.toISOString();
  leaseExpiresAt = new Date(now.getTime() + LEASE_TTL_MS).toISOString();
  await renewLease(db, working.id, claimToken, nowIso, leaseExpiresAt);

  await services.roundStore.saveRound(result);

  if (services.faults?.beforeFinalize) {
    await services.faults.beforeFinalize();
  }
  now = clock.now();
  nowIso = now.toISOString();
  await finalizeSettled(db, working.id, claimToken, result, nowIso);
  return { kind: "ok", result };
}

async function resumeExistingRound(
  db: Db,
  services: SpinOrchestratorServices,
  existing: RoundRow,
  requestHash: string,
  playerCurrency: string,
  claimToken: string,
  leaseExpiresAt: string,
  nowIso: string,
  nowMs: number,
): Promise<OrchestrateSpinResult> {
  if (existing.requestHash !== requestHash) {
    return { kind: "conflict" };
  }
  if (existing.status === "SETTLED") {
    const record = await toIdempotencyRecord(db, existing, existing.playerId);
    if (record.result) return { kind: "idempotent", result: record.result };
    return { kind: "error", message: "Settled round outcome unavailable" };
  }
  if (existing.status === "VOID") {
    return { kind: "error", message: "Round void; retry with a new idempotency key" };
  }
  if (existing.status === "PENDING") {
    if (!isLeaseExpired(existing.leaseExpiresAt, nowMs)) {
      return { kind: "in_progress" };
    }
    const taken = await takeOverStalePending(
      db,
      existing,
      claimToken,
      leaseExpiresAt,
      nowIso,
      nowMs,
    );
    if (!taken) return { kind: "in_progress" };
    const row = (await loadRoundByIdempotency(
      db,
      existing.playerId,
      existing.idempotencyKey,
    ))!;
    try {
      return await completeFromPendingRow(db, services, row, playerCurrency, claimToken);
    } catch (error) {
      if (error instanceof LeaseFencedError) {
        return { kind: "in_progress" };
      }
      const mismatch = asMathVersionMismatchResult(error);
      if (mismatch) return mismatch;
      return {
        kind: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
  return { kind: "error", message: `Unexpected round status: ${existing.status}` };
}

export async function orchestrateSpin(
  db: Db,
  services: SpinOrchestratorServices,
  input: {
    playerId: string;
    playerCurrency: string;
    publicSpin: PublicSpinRequest;
    requestHash: string;
    canonicalPayload: string;
  },
): Promise<OrchestrateSpinResult> {
  const clock = services.clock ?? systemClock;
  const now = clock.now();
  const nowIso = now.toISOString();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_TTL_MS).toISOString();
  const claimToken = generateId("claim");

  let existing = await loadRoundByIdempotency(
    db,
    input.playerId,
    input.publicSpin.idempotencyKey,
  );
  if (existing?.status === "VOID" && !existing.walletApplied) {
    await db.delete(schema.gameRounds).where(eq(schema.gameRounds.id, existing.id));
    existing = undefined;
  }
  if (existing) {
    return resumeExistingRound(
      db,
      services,
      existing,
      input.requestHash,
      input.playerCurrency,
      claimToken,
      leaseExpiresAt,
      nowIso,
      now.getTime(),
    );
  }

  const mathConfig = requireExecutableMath(services);

  let totalBetMinor: number;
  try {
    ({ totalBetMinor } = validateBetConfiguration(input.publicSpin, mathConfig));
  } catch (error) {
    if (error instanceof RoundValidationError) {
      return { kind: "validation", message: error.message };
    }
    throw error;
  }

  // Bound check before claiming a new round. Never rewrite session.math_version_id.
  const sessionForMath = await getSessionForPlayer(
    db,
    input.publicSpin.sessionId,
    input.playerId,
  );
  if (!sessionForMath) {
    return { kind: "session_not_found" };
  }
  try {
    assertPersistedMathVersionMatch(
      sessionForMath.mathVersionId,
      mathConfig,
      "session",
      sessionForMath.id,
    );
  } catch (error) {
    const mismatch = asMathVersionMismatchResult(error);
    if (mismatch) return mismatch;
    throw error;
  }

  let claim;
  try {
    claim = await claimRoundAndReserveSession(db, {
      playerId: input.playerId,
      sessionId: input.publicSpin.sessionId,
      playerCurrency: input.playerCurrency,
      idempotencyKey: input.publicSpin.idempotencyKey,
      requestHash: input.requestHash,
      requestPayload: input.canonicalPayload,
      totalBetMinor,
      claimToken,
      leaseExpiresAt,
      nowIso,
      faults: services.faults,
    });
  } catch (error) {
    // Fault after free reserve before claim rolls back via TX.
    return {
      kind: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }

  if (claim.kind === "exists") {
    return resumeExistingRound(
      db,
      services,
      claim.row,
      input.requestHash,
      input.playerCurrency,
      claimToken,
      leaseExpiresAt,
      nowIso,
      now.getTime(),
    );
  }
  if (claim.kind !== "claimed") {
    return mapSessionFailure(claim.kind);
  }

  try {
    const claimedRound = (await loadRoundByIdempotency(
      db,
      input.playerId,
      input.publicSpin.idempotencyKey,
    ))!;
    assertPersistedMathVersionMatch(
      claimedRound.mathVersionId,
      mathConfig,
      "round",
      claimedRound.id,
    );

    const request: SpinRequest = {
      sessionId: input.publicSpin.sessionId,
      playerId: input.playerId,
      currency: claim.session.currency,
      roomBase: input.publicSpin.roomBase,
      betLevel: input.publicSpin.betLevel,
      betMultiplier: input.publicSpin.betMultiplier,
      idempotencyKey: input.publicSpin.idempotencyKey,
      isFreeGame: claim.isFreeGame,
      freeGamesRemainingBefore: claim.freeGamesBefore,
    };

    const outcome = generateSpinOutcomeOnly(
      mathConfig,
      totalBetMinor,
      claim.isFreeGame,
      services.testFixedGrid,
    );
    const partial = buildSpinResultSkeleton({
      roundId: claim.roundId,
      request,
      mathVersion: mathConfig.version,
      totalBetMinor,
      outcome,
      freeGamesRemaining: Math.max(
        0,
        claim.isFreeGame ? claim.freeGamesBefore - 1 : claim.freeGamesBefore,
      ),
    });
    await persistOutcomeReady(
      db,
      claim.roundId,
      claimToken,
      partial,
      nowIso,
      leaseExpiresAt,
    );
    if (services.faults?.afterOutcomePersist) {
      await services.faults.afterOutcomePersist();
    }

    const row = (await loadRoundByIdempotency(
      db,
      input.playerId,
      input.publicSpin.idempotencyKey,
    ))!;
    return await completeFromPendingRow(
      db,
      services,
      row,
      input.playerCurrency,
      claimToken,
    );
  } catch (error) {
    if (error instanceof LeaseFencedError) {
      return { kind: "in_progress" };
    }
    const mismatch = asMathVersionMismatchResult(error);
    if (mismatch) return mismatch;
    const row = await loadRoundByIdempotency(
      db,
      input.playerId,
      input.publicSpin.idempotencyKey,
    );
    // Durable outcome / wallet-applied / unknown wallet → keep PENDING.
    if (row?.walletApplied || row?.outcomeJson) {
      return {
        kind: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
    if (isClearWalletRejection(error) && row && row.claimToken === claimToken) {
      await releaseClearReject(db, row, claimToken, nowIso, services.faults);
      return {
        kind: "insufficient_balance",
        message: error instanceof Error ? error.message : "Insufficient balance",
      };
    }
    // Pre-outcome failure: fenced atomic restore+delete only while we still own the lease.
    if (row && !row.walletApplied && row.claimToken === claimToken) {
      await releaseRejectedRoundAtomic(db, {
        roundId: row.id,
        sessionId: row.sessionId,
        playerId: row.playerId,
        claimToken,
        nowIso,
        faults: services.faults,
      });
    }
    if (error instanceof RoundValidationError) {
      return { kind: "validation", message: error.message };
    }
    if (error instanceof Error && error.name === "RealMoneyBlockedError") {
      return { kind: "real_money_blocked", message: error.message };
    }
    return {
      kind: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

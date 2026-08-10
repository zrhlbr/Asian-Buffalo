/**
 * Withdrawal requests — debit-on-request hold via MoneyService.debit.
 * Status: PENDING → UNDER_REVIEW → APPROVED → PAYING → PAID | REJECTED | CANCELLED | FAILED.
 * Anti-overdraw / anti-double via ledger idempotency + unique request keys.
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";
import { InsufficientBalanceError } from "./wallet-adapter.ts";
import { createRouteMoneyService } from "./route-money-services.ts";
import { ensureWalletCommerceReady } from "./wallet-commerce-bootstrap.ts";
import { listPaymentChannels } from "./deposit-service.ts";

type AppDb = DrizzleD1Database<typeof schema>;

export const WITHDRAWAL_STATUSES = [
  "PENDING",
  "UNDER_REVIEW",
  "APPROVED",
  "PAYING",
  "PAID",
  "REJECTED",
  "CANCELLED",
  "FAILED",
] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export type WithdrawalConfig = {
  currencies: string[];
  minMinor: number;
  maxMinor: number;
  dailyCapMinor: number;
  feeMinor: number;
  feeBps: number;
  reviewAboveMinor: number;
};

export type WithdrawalView = {
  id: string;
  playerId: string;
  currency: string;
  channelCode: string;
  accountMasked: string;
  amountMinor: number;
  feeMinor: number;
  expectedMinor: number;
  status: WithdrawalStatus;
  riskFlag: string | null;
  reviewRequired: boolean;
  failReason: string | null;
  createdAt: string;
  updatedAt: string;
};

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function nowSql(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function maskAccount(account: string): string {
  const trimmed = account.trim();
  if (trimmed.length <= 4) return "****";
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}****${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 3)}****${trimmed.slice(-4)}`;
}

/** Opaque storage — not encryption at rest in TEST; never return raw to other players. */
function storeAccount(account: string): string {
  const bytes = new TextEncoder().encode(account.trim());
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function mapRow(row: Record<string, unknown>): WithdrawalView {
  return {
    id: String(row.id),
    playerId: String(row.player_id),
    currency: String(row.currency),
    channelCode: String(row.channel_code),
    accountMasked: String(row.account_masked),
    amountMinor: Number(row.amount_minor),
    feeMinor: Number(row.fee_minor ?? 0),
    expectedMinor: Number(row.expected_minor),
    status: String(row.status) as WithdrawalStatus,
    riskFlag: row.risk_flag ? String(row.risk_flag) : null,
    reviewRequired: Number(row.review_required) === 1,
    failReason: row.fail_reason ? String(row.fail_reason) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getWithdrawalConfig(db: AppDb): Promise<WithdrawalConfig> {
  await ensureWalletCommerceReady(db);
  const rows = await db.all<{ value_json: string }>(sql`
    SELECT value_json FROM wallet_commerce_config WHERE key = 'withdrawal' LIMIT 1
  `);
  const fallback: WithdrawalConfig = {
    currencies: ["MMK"],
    minMinor: 5000,
    maxMinor: 200000,
    dailyCapMinor: 500000,
    feeMinor: 0,
    feeBps: 0,
    reviewAboveMinor: 50000,
  };
  const parsed = parseJson<Partial<WithdrawalConfig>>(rows[0]?.value_json, {});
  return {
    currencies: Array.isArray(parsed.currencies) ? parsed.currencies.map(String) : fallback.currencies,
    minMinor: Number(parsed.minMinor ?? fallback.minMinor),
    maxMinor: Number(parsed.maxMinor ?? fallback.maxMinor),
    dailyCapMinor: Number(parsed.dailyCapMinor ?? fallback.dailyCapMinor),
    feeMinor: Number(parsed.feeMinor ?? fallback.feeMinor),
    feeBps: Number(parsed.feeBps ?? fallback.feeBps),
    reviewAboveMinor: Number(parsed.reviewAboveMinor ?? fallback.reviewAboveMinor),
  };
}

export async function upsertWithdrawalConfig(
  db: AppDb,
  value: Partial<WithdrawalConfig>,
): Promise<WithdrawalConfig> {
  await ensureWalletCommerceReady(db);
  const current = await getWithdrawalConfig(db);
  const next: WithdrawalConfig = {
    currencies: Array.isArray(value.currencies) ? value.currencies.map(String) : current.currencies,
    minMinor: Number(value.minMinor ?? current.minMinor),
    maxMinor: Number(value.maxMinor ?? current.maxMinor),
    dailyCapMinor: Number(value.dailyCapMinor ?? current.dailyCapMinor),
    feeMinor: Number(value.feeMinor ?? current.feeMinor),
    feeBps: Number(value.feeBps ?? current.feeBps),
    reviewAboveMinor: Number(value.reviewAboveMinor ?? current.reviewAboveMinor),
  };
  await db.run(sql`
    INSERT INTO wallet_commerce_config ("key", "value_json", "updated_at")
    VALUES ('withdrawal', ${JSON.stringify({ ...next, note: "BR-006 admin-configured" })}, ${nowSql()})
    ON CONFLICT("key") DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = excluded.updated_at
  `);
  return next;
}

export async function sumFrozenWithdrawals(
  db: AppDb,
  playerId: string,
  currency: string,
): Promise<number> {
  await ensureWalletCommerceReady(db);
  const rows = await db.all<{ n: number }>(sql`
    SELECT COALESCE(SUM(amount_minor), 0) AS n FROM withdrawal_requests
    WHERE player_id = ${playerId}
      AND currency = ${currency}
      AND status IN ('PENDING','UNDER_REVIEW','APPROVED','PAYING')
  `);
  return Number(rows[0]?.n ?? 0);
}

async function sumDailyWithdrawals(
  db: AppDb,
  playerId: string,
  currency: string,
): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  const rows = await db.all<{ n: number }>(sql`
    SELECT COALESCE(SUM(amount_minor), 0) AS n FROM withdrawal_requests
    WHERE player_id = ${playerId}
      AND currency = ${currency}
      AND status NOT IN ('REJECTED','CANCELLED','FAILED')
      AND created_at >= ${`${day} 00:00:00`}
  `);
  return Number(rows[0]?.n ?? 0);
}

export async function listPlayerWithdrawals(
  db: AppDb,
  playerId: string,
  limit = 20,
): Promise<WithdrawalView[]> {
  await ensureWalletCommerceReady(db);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM withdrawal_requests
    WHERE player_id = ${playerId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  return rows.map(mapRow);
}

export async function getWithdrawal(
  db: AppDb,
  id: string,
): Promise<WithdrawalView | null> {
  await ensureWalletCommerceReady(db);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM withdrawal_requests WHERE id = ${id} LIMIT 1
  `);
  return rows[0] ? mapRow(rows[0]) : null;
}

export type CreateWithdrawalResult =
  | { ok: true; request: WithdrawalView; alreadyExists?: boolean }
  | { ok: false; code: string; message: string };

export async function createWithdrawalRequest(
  db: AppDb,
  input: {
    playerId: string;
    currency: string;
    channelCode: string;
    account: string;
    amountMinor: number;
    idempotencyKey: string;
    moneyService?: ReturnType<typeof createRouteMoneyService>;
  },
): Promise<CreateWithdrawalResult> {
  await ensureWalletCommerceReady(db);
  const cfg = await getWithdrawalConfig(db);
  if (!cfg.currencies.includes(input.currency)) {
    return { ok: false, code: "CURRENCY_UNSUPPORTED", message: "Currency not enabled for withdrawal" };
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    return { ok: false, code: "INVALID_AMOUNT", message: "amountMinor must be positive integer" };
  }
  if (input.amountMinor < cfg.minMinor || input.amountMinor > cfg.maxMinor) {
    return { ok: false, code: "AMOUNT_OUT_OF_RANGE", message: "Amount outside admin min/max" };
  }
  const account = input.account.trim();
  if (account.length < 4 || account.length > 128) {
    return { ok: false, code: "INVALID_ACCOUNT", message: "Withdrawal account invalid" };
  }

  const channels = await listPaymentChannels(db, {
    currency: input.currency,
    enabledOnly: true,
  });
  if (!channels.some((c) => c.code === input.channelCode)) {
    return { ok: false, code: "CHANNEL_UNAVAILABLE", message: "Payment channel unavailable" };
  }

  const idem = input.idempotencyKey.trim();
  if (!idem) {
    return { ok: false, code: "IDEMPOTENCY_REQUIRED", message: "idempotencyKey is required" };
  }

  const existing = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM withdrawal_requests WHERE idempotency_key = ${idem} LIMIT 1
  `);
  if (existing[0]) {
    const req = mapRow(existing[0]);
    if (req.playerId !== input.playerId) {
      return { ok: false, code: "IDEMPOTENCY_CONFLICT", message: "Idempotency key belongs to another player" };
    }
    return { ok: true, request: req, alreadyExists: true };
  }

  const feeFromBps = Math.floor((input.amountMinor * cfg.feeBps) / 10_000);
  const feeMinor = Math.max(cfg.feeMinor, feeFromBps);
  const expectedMinor = Math.max(0, input.amountMinor - feeMinor);
  const daily = await sumDailyWithdrawals(db, input.playerId, input.currency);
  if (daily + input.amountMinor > cfg.dailyCapMinor) {
    return { ok: false, code: "DAILY_CAP", message: "Daily withdrawal cap exceeded" };
  }

  const reviewRequired = input.amountMinor >= cfg.reviewAboveMinor ? 1 : 1; // always review in V1 fail-closed
  const riskFlag =
    input.amountMinor >= cfg.reviewAboveMinor ? "AMOUNT_REVIEW" : "STANDARD";
  const status: WithdrawalStatus = "UNDER_REVIEW";

  const money = input.moneyService ?? createRouteMoneyService(db);
  const available = await money.getAvailableBalance(input.playerId, input.currency);
  if (available < input.amountMinor) {
    return { ok: false, code: "INSUFFICIENT_BALANCE", message: "Insufficient available balance" };
  }

  const id = crypto.randomUUID();
  const holdKey = `withdraw-hold:${id}`;
  const created = nowSql();

  try {
    await money.debit({
      playerId: input.playerId,
      currency: input.currency,
      amountMinor: input.amountMinor,
      idempotencyKey: holdKey,
    });
  } catch (cause) {
    if (cause instanceof InsufficientBalanceError) {
      return { ok: false, code: "INSUFFICIENT_BALANCE", message: "Insufficient available balance" };
    }
    return {
      ok: false,
      code: "HOLD_FAILED",
      message: cause instanceof Error ? cause.message : "Hold debit failed",
    };
  }

  try {
    await db.run(sql`
      INSERT INTO withdrawal_requests
        ("id", "player_id", "currency", "channel_code", "account_masked", "account_cipher",
         "amount_minor", "fee_minor", "expected_minor", "status", "risk_flag",
         "review_required", "idempotency_key", "hold_intent_key", "created_at", "updated_at")
      VALUES (
        ${id}, ${input.playerId}, ${input.currency}, ${input.channelCode},
        ${maskAccount(account)}, ${storeAccount(account)},
        ${input.amountMinor}, ${feeMinor}, ${expectedMinor}, ${status}, ${riskFlag},
        ${reviewRequired}, ${idem}, ${holdKey}, ${created}, ${created}
      )
    `);
  } catch {
    // Unique race — refund hold if our insert lost; otherwise return existing
    const again = await db.all<Record<string, unknown>>(sql`
      SELECT * FROM withdrawal_requests WHERE idempotency_key = ${idem} LIMIT 1
    `);
    if (again[0]) {
      return { ok: true, request: mapRow(again[0]), alreadyExists: true };
    }
    try {
      await money.credit({
        playerId: input.playerId,
        currency: input.currency,
        amountMinor: input.amountMinor,
        idempotencyKey: `withdraw-release:${id}`,
      });
    } catch {
      /* leave UNKNOWN for recovery — fail closed */
    }
    return { ok: false, code: "CREATE_FAILED", message: "Failed to create withdrawal request" };
  }

  const request = await getWithdrawal(db, id);
  if (!request) {
    return { ok: false, code: "CREATE_FAILED", message: "Request missing after insert" };
  }
  return { ok: true, request };
}

export type ReviewWithdrawalResult =
  | { ok: true; request: WithdrawalView }
  | { ok: false; code: string; message: string };

export async function reviewWithdrawal(
  db: AppDb,
  input: {
    id: string;
    action: "APPROVE" | "REJECT";
    adminId: string;
    reason: string;
    moneyService?: ReturnType<typeof createRouteMoneyService>;
  },
): Promise<ReviewWithdrawalResult> {
  await ensureWalletCommerceReady(db);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM withdrawal_requests WHERE id = ${input.id} LIMIT 1
  `);
  const row = rows[0];
  if (!row) return { ok: false, code: "NOT_FOUND", message: "Withdrawal not found" };
  const current = mapRow(row);
  if (!["PENDING", "UNDER_REVIEW"].includes(current.status)) {
    return { ok: false, code: "INVALID_STATUS", message: `Cannot review from ${current.status}` };
  }

  const money = input.moneyService ?? createRouteMoneyService(db);
  const ts = nowSql();

  if (input.action === "REJECT") {
    const holdKey = row.hold_intent_key ? String(row.hold_intent_key) : `withdraw-hold:${current.id}`;
    try {
      await money.credit({
        playerId: current.playerId,
        currency: current.currency,
        amountMinor: current.amountMinor,
        idempotencyKey: `withdraw-release:${current.id}`,
      });
    } catch (cause) {
      return {
        ok: false,
        code: "RELEASE_FAILED",
        message: cause instanceof Error ? cause.message : "Release credit failed",
      };
    }
    void holdKey;
    await db.run(sql`
      UPDATE withdrawal_requests
      SET status = 'REJECTED', fail_reason = ${input.reason},
          reviewed_by = ${input.adminId}, reviewed_at = ${ts}, updated_at = ${ts}
      WHERE id = ${current.id}
    `);
  } else {
    await db.run(sql`
      UPDATE withdrawal_requests
      SET status = 'APPROVED',
          reviewed_by = ${input.adminId}, reviewed_at = ${ts}, updated_at = ${ts}
      WHERE id = ${current.id}
    `);
  }

  const updated = await getWithdrawal(db, current.id);
  return { ok: true, request: updated ?? current };
}

/** Mark approved withdrawal as PAID (provider pay harness). Hold already debited. */
export async function markWithdrawalPaid(
  db: AppDb,
  input: { id: string; adminId: string; reason: string },
): Promise<ReviewWithdrawalResult> {
  await ensureWalletCommerceReady(db);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM withdrawal_requests WHERE id = ${input.id} LIMIT 1
  `);
  const row = rows[0];
  if (!row) return { ok: false, code: "NOT_FOUND", message: "Withdrawal not found" };
  const current = mapRow(row);
  if (!["APPROVED", "PAYING"].includes(current.status)) {
    return { ok: false, code: "INVALID_STATUS", message: `Cannot pay from ${current.status}` };
  }
  const ts = nowSql();
  await db.run(sql`
    UPDATE withdrawal_requests
    SET status = 'PAID', ledger_intent_key = COALESCE(hold_intent_key, ledger_intent_key),
        reviewed_by = ${input.adminId}, updated_at = ${ts}
    WHERE id = ${current.id}
  `);
  const updated = await getWithdrawal(db, current.id);
  return { ok: true, request: updated ?? current };
}

export async function cancelWithdrawal(
  db: AppDb,
  input: {
    id: string;
    playerId: string;
    moneyService?: ReturnType<typeof createRouteMoneyService>;
  },
): Promise<ReviewWithdrawalResult> {
  await ensureWalletCommerceReady(db);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM withdrawal_requests WHERE id = ${input.id} LIMIT 1
  `);
  const row = rows[0];
  if (!row) return { ok: false, code: "NOT_FOUND", message: "Withdrawal not found" };
  const current = mapRow(row);
  if (current.playerId !== input.playerId) {
    return { ok: false, code: "FORBIDDEN", message: "Cross-player withdrawal access denied" };
  }
  if (!["PENDING", "UNDER_REVIEW"].includes(current.status)) {
    return { ok: false, code: "INVALID_STATUS", message: `Cannot cancel from ${current.status}` };
  }
  const money = input.moneyService ?? createRouteMoneyService(db);
  try {
    await money.credit({
      playerId: current.playerId,
      currency: current.currency,
      amountMinor: current.amountMinor,
      idempotencyKey: `withdraw-release:${current.id}`,
    });
  } catch (cause) {
    return {
      ok: false,
      code: "RELEASE_FAILED",
      message: cause instanceof Error ? cause.message : "Release credit failed",
    };
  }
  const ts = nowSql();
  await db.run(sql`
    UPDATE withdrawal_requests
    SET status = 'CANCELLED', updated_at = ${ts}, fail_reason = 'PLAYER_CANCEL'
    WHERE id = ${current.id}
  `);
  const updated = await getWithdrawal(db, current.id);
  return { ok: true, request: updated ?? current };
}

export async function listAdminWithdrawals(
  db: AppDb,
  opts: { playerId?: string; status?: string; limit?: number; offset?: number },
): Promise<{ items: WithdrawalView[]; total: number }> {
  await ensureWalletCommerceReady(db);
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const playerId = opts.playerId?.trim() || null;
  const status = opts.status?.trim() || null;
  const totalRows = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM withdrawal_requests
    WHERE (${playerId} IS NULL OR player_id = ${playerId})
      AND (${status} IS NULL OR status = ${status})
  `);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM withdrawal_requests
    WHERE (${playerId} IS NULL OR player_id = ${playerId})
      AND (${status} IS NULL OR status = ${status})
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
  return { items: rows.map(mapRow), total: Number(totalRows[0]?.n ?? 0) };
}

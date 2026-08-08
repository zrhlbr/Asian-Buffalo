/**
 * Deposit orders — create → provider callback / test confirm → MoneyService.credit.
 * Amounts from admin config presets only. Fail closed on mismatch / double credit.
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";
import { createRouteMoneyService } from "./route-money-services.ts";
import { ensureWalletCommerceReady } from "./wallet-commerce-bootstrap.ts";
import {
  buildCommerceReadiness,
  configIsProductionReady,
  mapChannelReadiness,
  type ChannelReadiness,
  type CommerceReadiness,
} from "./payment-readiness.ts";

type AppDb = DrizzleD1Database<typeof schema>;

export const DEPOSIT_STATUSES = [
  "CREATED",
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

export type DepositConfig = {
  currencies: string[];
  presetsMinor: number[];
  minMinor: number;
  maxMinor: number;
  orderTtlMinutes: number;
  productionReady: boolean;
};

export type PaymentChannelView = {
  code: string;
  title: Record<string, string>;
  currency: string;
  enabled: boolean;
  sortOrder: number;
  readiness: ChannelReadiness;
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

function addMinutes(isoSql: string, minutes: number): string {
  const ms = new Date(isoSql.replace(" ", "T") + "Z").getTime() + minutes * 60_000;
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

export async function getDepositConfig(db: AppDb): Promise<DepositConfig> {
  await ensureWalletCommerceReady(db);
  const rows = await db.all<{ value_json: string }>(sql`
    SELECT value_json FROM wallet_commerce_config WHERE key = 'deposit' LIMIT 1
  `);
  const fallback: DepositConfig = {
    currencies: ["MMK"],
    presetsMinor: [1000, 5000, 10000, 50000],
    minMinor: 1000,
    maxMinor: 500000,
    orderTtlMinutes: 30,
    productionReady: false,
  };
  const parsed = parseJson<Partial<DepositConfig> & Record<string, unknown>>(
    rows[0]?.value_json,
    {},
  );
  return {
    currencies: Array.isArray(parsed.currencies) ? parsed.currencies.map(String) : fallback.currencies,
    presetsMinor: Array.isArray(parsed.presetsMinor)
      ? parsed.presetsMinor.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : fallback.presetsMinor,
    minMinor: Number(parsed.minMinor ?? fallback.minMinor),
    maxMinor: Number(parsed.maxMinor ?? fallback.maxMinor),
    orderTtlMinutes: Number(parsed.orderTtlMinutes ?? fallback.orderTtlMinutes),
    productionReady: configIsProductionReady(parsed),
  };
}

export async function listPaymentChannels(
  db: AppDb,
  opts?: { currency?: string; enabledOnly?: boolean },
): Promise<PaymentChannelView[]> {
  await ensureWalletCommerceReady(db);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT code, title_json, currency, enabled, sort_order, config_json
    FROM payment_channels
    ORDER BY sort_order ASC, code ASC
  `);
  return rows
    .map((r) => {
      const code = String(r.code);
      const currency = String(r.currency);
      const enabled = Number(r.enabled) === 1;
      return {
        code,
        title: parseJson(r.title_json, {}),
        currency,
        enabled,
        sortOrder: Number(r.sort_order ?? 0),
        readiness: mapChannelReadiness({
          code,
          currency,
          enabled,
          configJson: r.config_json,
        }),
      };
    })
    .filter((c) => (opts?.enabledOnly ? c.enabled : true))
    .filter((c) => (opts?.currency ? c.currency === opts.currency : true));
}

/** Aggregate BR-005..007 readiness for FE fail-closed banner. */
export async function getPaymentCommerceReadiness(db: AppDb): Promise<CommerceReadiness> {
  const deposit = await getDepositConfig(db);
  const channels = await listPaymentChannels(db);
  const wdRows = await db.all<{ value_json: string }>(sql`
    SELECT value_json FROM wallet_commerce_config WHERE key = 'withdrawal' LIMIT 1
  `);
  const wdParsed = parseJson<Record<string, unknown>>(wdRows[0]?.value_json, {});
  return buildCommerceReadiness(
    channels.map((c) => c.readiness),
    {
      depositProductionReady: deposit.productionReady,
      withdrawalProductionReady: configIsProductionReady(wdParsed),
    },
  );
}

export type DepositOrderView = {
  id: string;
  playerId: string;
  currency: string;
  channelCode: string;
  amountMinor: number;
  status: DepositStatus;
  providerRef: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  failReason: string | null;
};

function mapOrder(row: Record<string, unknown>): DepositOrderView {
  return {
    id: String(row.id),
    playerId: String(row.player_id),
    currency: String(row.currency),
    channelCode: String(row.channel_code),
    amountMinor: Number(row.amount_minor),
    status: String(row.status) as DepositStatus,
    providerRef: row.provider_ref ? String(row.provider_ref) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    failReason: row.fail_reason ? String(row.fail_reason) : null,
  };
}

export async function listPlayerDeposits(
  db: AppDb,
  playerId: string,
  limit = 20,
): Promise<DepositOrderView[]> {
  await ensureWalletCommerceReady(db);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM deposit_orders
    WHERE player_id = ${playerId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  return rows.map(mapOrder);
}

export async function getDepositOrder(
  db: AppDb,
  orderId: string,
): Promise<DepositOrderView | null> {
  await ensureWalletCommerceReady(db);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM deposit_orders WHERE id = ${orderId} LIMIT 1
  `);
  return rows[0] ? mapOrder(rows[0]) : null;
}

export type CreateDepositResult =
  | { ok: true; order: DepositOrderView; alreadyExists?: boolean }
  | { ok: false; code: string; message: string };

export async function createDepositOrder(
  db: AppDb,
  input: {
    playerId: string;
    currency: string;
    channelCode: string;
    amountMinor: number;
    idempotencyKey: string;
  },
): Promise<CreateDepositResult> {
  await ensureWalletCommerceReady(db);
  const cfg = await getDepositConfig(db);
  if (!cfg.currencies.includes(input.currency)) {
    return { ok: false, code: "CURRENCY_UNSUPPORTED", message: "Currency not enabled for deposit" };
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    return { ok: false, code: "INVALID_AMOUNT", message: "amountMinor must be positive integer" };
  }
  if (
    !cfg.presetsMinor.includes(input.amountMinor) &&
    (input.amountMinor < cfg.minMinor || input.amountMinor > cfg.maxMinor)
  ) {
    return {
      ok: false,
      code: "AMOUNT_NOT_ALLOWED",
      message: "Amount must be a configured preset or within admin min/max",
    };
  }
  // Prefer presets: if presets configured, require membership (fail closed vs free-form forge)
  if (cfg.presetsMinor.length > 0 && !cfg.presetsMinor.includes(input.amountMinor)) {
    return {
      ok: false,
      code: "AMOUNT_NOT_IN_PRESETS",
      message: "Amount must match an admin deposit preset",
    };
  }

  const channels = await listPaymentChannels(db, {
    currency: input.currency,
    enabledOnly: true,
  });
  const channel = channels.find((c) => c.code === input.channelCode);
  if (!channel) {
    return { ok: false, code: "CHANNEL_UNAVAILABLE", message: "Payment channel unavailable" };
  }

  const idem = input.idempotencyKey.trim();
  if (!idem) {
    return { ok: false, code: "IDEMPOTENCY_REQUIRED", message: "idempotencyKey is required" };
  }

  const existing = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM deposit_orders WHERE idempotency_key = ${idem} LIMIT 1
  `);
  if (existing[0]) {
    const order = mapOrder(existing[0]);
    if (order.playerId !== input.playerId) {
      return { ok: false, code: "IDEMPOTENCY_CONFLICT", message: "Idempotency key belongs to another player" };
    }
    return { ok: true, order, alreadyExists: true };
  }

  const id = crypto.randomUUID();
  const created = nowSql();
  const expiresAt = addMinutes(created, cfg.orderTtlMinutes);
  const providerRef = `dep_${id.replace(/-/g, "").slice(0, 24)}`;

  try {
    await db.run(sql`
      INSERT INTO deposit_orders
        ("id", "player_id", "currency", "channel_code", "amount_minor", "status",
         "provider_ref", "idempotency_key", "expires_at", "created_at", "updated_at")
      VALUES (
        ${id}, ${input.playerId}, ${input.currency}, ${input.channelCode}, ${input.amountMinor},
        'PENDING', ${providerRef}, ${idem}, ${expiresAt}, ${created}, ${created}
      )
    `);
  } catch {
    const again = await db.all<Record<string, unknown>>(sql`
      SELECT * FROM deposit_orders WHERE idempotency_key = ${idem} LIMIT 1
    `);
    if (again[0]) return { ok: true, order: mapOrder(again[0]), alreadyExists: true };
    return { ok: false, code: "CREATE_FAILED", message: "Failed to create deposit order" };
  }

  const order = await getDepositOrder(db, id);
  if (!order) return { ok: false, code: "CREATE_FAILED", message: "Order missing after insert" };
  return { ok: true, order };
}

export type ConfirmDepositResult =
  | {
      ok: true;
      order: DepositOrderView;
      alreadyCredited?: boolean;
      balanceAfterMinor: number;
    }
  | { ok: false; code: string; message: string };

/**
 * Provider callback / test harness confirm.
 * Credits exactly once via MoneyService; amount must match order (never client amount).
 */
export async function confirmDepositOrder(
  db: AppDb,
  input: {
    orderId?: string;
    providerRef?: string;
    expectedAmountMinor?: number;
    playerId?: string;
    moneyService?: ReturnType<typeof createRouteMoneyService>;
  },
): Promise<ConfirmDepositResult> {
  await ensureWalletCommerceReady(db);
  let rows: Record<string, unknown>[] = [];
  if (input.orderId) {
    rows = await db.all<Record<string, unknown>>(sql`
      SELECT * FROM deposit_orders WHERE id = ${input.orderId} LIMIT 1
    `);
  } else if (input.providerRef) {
    rows = await db.all<Record<string, unknown>>(sql`
      SELECT * FROM deposit_orders WHERE provider_ref = ${input.providerRef} LIMIT 1
    `);
  } else {
    return { ok: false, code: "INVALID_REQUEST", message: "orderId or providerRef required" };
  }
  const row = rows[0];
  if (!row) return { ok: false, code: "NOT_FOUND", message: "Deposit order not found" };
  const order = mapOrder(row);
  if (input.playerId && order.playerId !== input.playerId) {
    return { ok: false, code: "FORBIDDEN", message: "Cross-player deposit access denied" };
  }

  const money = input.moneyService ?? createRouteMoneyService(db);

  if (order.status === "SUCCESS") {
    const bal = await money.getAvailableBalance(order.playerId, order.currency);
    return { ok: true, order, alreadyCredited: true, balanceAfterMinor: bal };
  }
  if (["FAILED", "EXPIRED", "CANCELLED"].includes(order.status)) {
    return { ok: false, code: "ORDER_CLOSED", message: `Order is ${order.status}` };
  }
  if (order.expiresAt) {
    const exp = new Date(order.expiresAt.replace(" ", "T") + "Z").getTime();
    if (Number.isFinite(exp) && exp < Date.now()) {
      await db.run(sql`
        UPDATE deposit_orders SET status = 'EXPIRED', updated_at = ${nowSql()}
        WHERE id = ${order.id} AND status IN ('CREATED','PENDING','PROCESSING')
      `);
      return { ok: false, code: "ORDER_EXPIRED", message: "Deposit order expired" };
    }
  }
  if (
    typeof input.expectedAmountMinor === "number" &&
    input.expectedAmountMinor !== order.amountMinor
  ) {
    return { ok: false, code: "AMOUNT_MISMATCH", message: "Provider amount does not match order" };
  }

  await db.run(sql`
    UPDATE deposit_orders SET status = 'PROCESSING', updated_at = ${nowSql()}
    WHERE id = ${order.id} AND status IN ('CREATED','PENDING')
  `);

  const ledgerKey =
    (row.ledger_intent_key ? String(row.ledger_intent_key) : null) ??
    `deposit:${order.id}`;

  try {
    await money.credit({
      playerId: order.playerId,
      currency: order.currency,
      amountMinor: order.amountMinor,
      idempotencyKey: ledgerKey,
    });
  } catch (cause) {
    await db.run(sql`
      UPDATE deposit_orders
      SET status = 'FAILED', fail_reason = ${cause instanceof Error ? cause.message : "CREDIT_FAILED"},
          updated_at = ${nowSql()}
      WHERE id = ${order.id} AND status = 'PROCESSING'
    `);
    return {
      ok: false,
      code: "CREDIT_FAILED",
      message: cause instanceof Error ? cause.message : "Credit failed",
    };
  }

  await db.run(sql`
    UPDATE deposit_orders
    SET status = 'SUCCESS', ledger_intent_key = ${ledgerKey}, updated_at = ${nowSql()}, fail_reason = NULL
    WHERE id = ${order.id}
  `);
  const updated = await getDepositOrder(db, order.id);
  const bal = await money.getAvailableBalance(order.playerId, order.currency);
  return {
    ok: true,
    order: updated ?? order,
    balanceAfterMinor: bal,
  };
}

export async function listAdminDeposits(
  db: AppDb,
  opts: { playerId?: string; status?: string; limit?: number; offset?: number },
): Promise<{ items: DepositOrderView[]; total: number }> {
  await ensureWalletCommerceReady(db);
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const playerId = opts.playerId?.trim() || null;
  const status = opts.status?.trim() || null;

  const totalRows = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM deposit_orders
    WHERE (${playerId} IS NULL OR player_id = ${playerId})
      AND (${status} IS NULL OR status = ${status})
  `);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM deposit_orders
    WHERE (${playerId} IS NULL OR player_id = ${playerId})
      AND (${status} IS NULL OR status = ${status})
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
  return { items: rows.map(mapOrder), total: Number(totalRows[0]?.n ?? 0) };
}

export async function upsertDepositConfig(
  db: AppDb,
  value: Partial<DepositConfig>,
): Promise<DepositConfig> {
  await ensureWalletCommerceReady(db);
  const current = await getDepositConfig(db);
  const next: DepositConfig = {
    currencies: Array.isArray(value.currencies) ? value.currencies.map(String) : current.currencies,
    presetsMinor: Array.isArray(value.presetsMinor)
      ? value.presetsMinor.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : current.presetsMinor,
    minMinor: Number(value.minMinor ?? current.minMinor),
    maxMinor: Number(value.maxMinor ?? current.maxMinor),
    orderTtlMinutes: Number(value.orderTtlMinutes ?? current.orderTtlMinutes),
    // Explicit admin flag only — never infer production readiness from placeholders.
    productionReady:
      typeof value.productionReady === "boolean"
        ? value.productionReady
        : current.productionReady,
  };
  await db.run(sql`
    INSERT INTO wallet_commerce_config ("key", "value_json", "updated_at")
    VALUES (
      'deposit',
      ${JSON.stringify({ ...next, note: "BR-005 admin-configured" })},
      ${nowSql()}
    )
    ON CONFLICT("key") DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = excluded.updated_at
  `);
  return next;
}

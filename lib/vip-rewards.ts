/**
 * VIP reward chests — claim via MoneyService.credit + claim idempotency.
 * Fail closed: VIP must be ACTIVE; amount from vip_reward_defs only.
 * FE animation is presentation-only (no balance writes on client).
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";
import { ensurePlayerCommerceReady } from "./player-commerce-bootstrap.ts";
import { createRouteMoneyService } from "./route-money-services.ts";
import { getPlayerVip } from "./vip-service.ts";

type AppDb = DrizzleD1Database<typeof schema>;

export type RewardChestView = {
  id: string;
  kind: string;
  title: Record<string, string>;
  amountMinor: number;
  currency: string;
  levelMin: number;
  levelMax: number;
  period: string | null;
  enabled: boolean;
  claimable: boolean;
  claimed: boolean;
  lockedReason: string | null;
  periodKey: string;
};

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function utcWeekKey(d = new Date()): string {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function utcMonthKey(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export function periodKeyFor(kind: string, period: string | null, vipLevel: number): string {
  const p = (period ?? kind).toUpperCase();
  if (p === "DAILY") return `daily:${utcDateKey()}`;
  if (p === "WEEKLY") return `weekly:${utcWeekKey()}`;
  if (p === "MONTHLY") return `monthly:${utcMonthKey()}`;
  if (p === "LEVEL") return `level:${vipLevel}`;
  if (p === "EVENT") return `event:${utcDateKey()}`;
  return `${p.toLowerCase()}:${utcDateKey()}`;
}

export async function listRewardChests(
  db: AppDb,
  playerId: string,
): Promise<RewardChestView[]> {
  await ensurePlayerCommerceReady(db);
  const vip = await getPlayerVip(db, playerId);
  const defs = await db.all<Record<string, unknown>>(sql`
    SELECT id, kind, level_min, level_max, amount_minor, currency, period, enabled, title_json
    FROM vip_reward_defs
    ORDER BY kind ASC
  `);

  const out: RewardChestView[] = [];
  for (const def of defs) {
    const id = String(def.id);
    const kind = String(def.kind);
    const levelMin = Number(def.level_min);
    const levelMax = Number(def.level_max);
    const amountMinor = Number(def.amount_minor);
    const currency = String(def.currency ?? "MMK");
    const period = def.period ? String(def.period) : null;
    const enabled = Number(def.enabled) === 1;
    const pk = periodKeyFor(kind, period, vip.level);
    const idem = `${playerId}:${id}:${pk}`;

    const claimedRows = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM vip_reward_claims
      WHERE idempotency_key = ${idem} AND status = 'CLAIMED'
    `);
    const claimed = Number(claimedRows[0]?.n ?? 0) > 0;

    let lockedReason: string | null = null;
    if (!enabled) lockedReason = "DISABLED";
    else if (vip.status !== "ACTIVE") lockedReason = "VIP_INACTIVE";
    else if (vip.level < levelMin || vip.level > levelMax) lockedReason = "VIP_LEVEL";
    else if (amountMinor <= 0) lockedReason = "ZERO_AMOUNT";
    else if (claimed) lockedReason = "ALREADY_CLAIMED";

    out.push({
      id,
      kind,
      title: parseJson(def.title_json, {}),
      amountMinor,
      currency,
      levelMin,
      levelMax,
      period,
      enabled,
      claimable: lockedReason == null,
      claimed,
      lockedReason,
      periodKey: pk,
    });
  }
  return out;
}

export type ClaimResult =
  | {
      ok: true;
      alreadyClaimed?: boolean;
      claimId: string;
      amountMinor: number;
      currency: string;
      balanceAfterMinor: number;
    }
  | { ok: false; code: string; message: string };

export async function claimRewardChest(
  db: AppDb,
  playerId: string,
  rewardDefId: string,
  clientIdempotencyKey?: string,
  moneyService?: ReturnType<typeof createRouteMoneyService>,
): Promise<ClaimResult> {
  await ensurePlayerCommerceReady(db);
  const chests = await listRewardChests(db, playerId);
  const chest = chests.find((c) => c.id === rewardDefId);
  if (!chest) return { ok: false, code: "NOT_FOUND", message: "Reward not found" };
  if (!chest.claimable && chest.lockedReason !== "ALREADY_CLAIMED") {
    return {
      ok: false,
      code: chest.lockedReason ?? "NOT_CLAIMABLE",
      message: "Reward not claimable",
    };
  }

  const idem =
    clientIdempotencyKey?.trim() ||
    `${playerId}:${chest.id}:${chest.periodKey}`;

  const resolveMoney = () => moneyService ?? createRouteMoneyService(db);

  const existing = await db.all<Record<string, unknown>>(sql`
    SELECT id, amount_minor, currency, status FROM vip_reward_claims
    WHERE idempotency_key = ${idem} LIMIT 1
  `);
  if (existing[0]) {
    const money = resolveMoney();
    const player = await db.all<{ currency: string }>(sql`
      SELECT currency FROM players WHERE id = ${playerId} LIMIT 1
    `);
    const currency = String(player[0]?.currency ?? existing[0].currency);
    const bal = await money.getAvailableBalance(playerId, currency);
    return {
      ok: true,
      alreadyClaimed: true,
      claimId: String(existing[0].id),
      amountMinor: Number(existing[0].amount_minor),
      currency,
      balanceAfterMinor: bal,
    };
  }

  if (chest.amountMinor <= 0) {
    return { ok: false, code: "ZERO_AMOUNT", message: "Reward amount is zero (BR-003)" };
  }

  const playerRows = await db.all<{ currency: string; status: string }>(sql`
    SELECT currency, status FROM players WHERE id = ${playerId} LIMIT 1
  `);
  const player = playerRows[0];
  if (!player || player.status !== "ACTIVE") {
    return { ok: false, code: "PLAYER_UNAVAILABLE", message: "Player unavailable" };
  }
  const currency = String(player.currency);
  if (currency !== chest.currency) {
    // Fail closed rather than cross-currency invent — BR-009
    return {
      ok: false,
      code: "CURRENCY_MISMATCH",
      message: "Reward currency does not match player wallet",
    };
  }

  const money = resolveMoney();
  const ledgerKey = `vip-reward:${idem}`;
  try {
    await money.credit({
      playerId,
      currency,
      amountMinor: chest.amountMinor,
      idempotencyKey: ledgerKey,
    });
  } catch (cause) {
    return {
      ok: false,
      code: "CREDIT_FAILED",
      message: cause instanceof Error ? cause.message : "Credit failed",
    };
  }

  const claimId = crypto.randomUUID();
  try {
    await db.run(sql`
      INSERT INTO vip_reward_claims
        ("id", "player_id", "reward_def_id", "idempotency_key", "period_key",
         "amount_minor", "currency", "status", "ledger_intent_key")
      VALUES (
        ${claimId}, ${playerId}, ${chest.id}, ${idem}, ${chest.periodKey},
        ${chest.amountMinor}, ${currency}, 'CLAIMED', ${ledgerKey}
      )
    `);
  } catch {
    // Unique race — treat as idempotent success
    const again = await db.all<Record<string, unknown>>(sql`
      SELECT id FROM vip_reward_claims WHERE idempotency_key = ${idem} LIMIT 1
    `);
    const bal = await money.getAvailableBalance(playerId, currency);
    return {
      ok: true,
      alreadyClaimed: true,
      claimId: String(again[0]?.id ?? claimId),
      amountMinor: chest.amountMinor,
      currency,
      balanceAfterMinor: bal,
    };
  }

  const balanceAfterMinor = await money.getAvailableBalance(playerId, currency);
  return {
    ok: true,
    claimId,
    amountMinor: chest.amountMinor,
    currency,
    balanceAfterMinor,
  };
}

/**
 * Activities + daily check-in — server claim → MoneyService.credit.
 * Expired activities not joinable. Idempotent claims.
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";
import { createRouteMoneyService } from "./route-money-services.ts";
import { ensureWalletCommerceReady } from "./wallet-commerce-bootstrap.ts";

type AppDb = DrizzleD1Database<typeof schema>;

export type ActivityView = {
  id: string;
  code: string;
  kind: string;
  title: Record<string, string>;
  body: Record<string, string>;
  rewardMinor: number;
  currency: string;
  startsAt: string | null;
  endsAt: string | null;
  enabled: boolean;
  joinable: boolean;
  claimed: boolean;
  lockedReason: string | null;
};

export type CheckinStatus = {
  enabled: boolean;
  rewardMinor: number;
  currency: string;
  dayKey: string;
  claimed: boolean;
  claimable: boolean;
};

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function nowMs(): number {
  return Date.now();
}

function parseSqlTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value.replace(" ", "T") + (value.endsWith("Z") ? "" : "Z")).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export async function listActivities(
  db: AppDb,
  playerId: string,
): Promise<ActivityView[]> {
  await ensureWalletCommerceReady(db);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM player_activities ORDER BY code ASC
  `);
  const out: ActivityView[] = [];
  for (const row of rows) {
    const id = String(row.id);
    const rewardMinor = Number(row.reward_minor ?? 0);
    const currency = String(row.currency ?? "MMK");
    const enabled = Number(row.enabled) === 1;
    const startsAt = row.starts_at ? String(row.starts_at) : null;
    const endsAt = row.ends_at ? String(row.ends_at) : null;
    const startMs = parseSqlTime(startsAt);
    const endMs = parseSqlTime(endsAt);
    const now = nowMs();

    let lockedReason: string | null = null;
    if (!enabled) lockedReason = "DISABLED";
    else if (startMs != null && now < startMs) lockedReason = "NOT_STARTED";
    else if (endMs != null && now > endMs) lockedReason = "EXPIRED";
    else if (rewardMinor <= 0) lockedReason = "ZERO_AMOUNT";

    const periodKey = `activity:${id}`;
    const idem = `${playerId}:${periodKey}`;
    const claimedRows = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM activity_claims
      WHERE idempotency_key = ${idem} AND status = 'CLAIMED'
    `);
    const claimed = Number(claimedRows[0]?.n ?? 0) > 0;
    if (claimed) lockedReason = lockedReason ?? "ALREADY_CLAIMED";

    out.push({
      id,
      code: String(row.code),
      kind: String(row.kind),
      title: parseJson(row.title_json, {}),
      body: parseJson(row.body_json, {}),
      rewardMinor,
      currency,
      startsAt,
      endsAt,
      enabled,
      joinable: lockedReason == null,
      claimed,
      lockedReason,
    });
  }
  return out;
}

export type ClaimActivityResult =
  | {
      ok: true;
      alreadyClaimed?: boolean;
      claimId: string;
      amountMinor: number;
      currency: string;
      balanceAfterMinor: number;
    }
  | { ok: false; code: string; message: string };

export async function claimActivity(
  db: AppDb,
  playerId: string,
  activityId: string,
  moneyService?: ReturnType<typeof createRouteMoneyService>,
): Promise<ClaimActivityResult> {
  await ensureWalletCommerceReady(db);
  const activities = await listActivities(db, playerId);
  const activity = activities.find((a) => a.id === activityId);
  if (!activity) return { ok: false, code: "NOT_FOUND", message: "Activity not found" };
  if (!activity.joinable && activity.lockedReason !== "ALREADY_CLAIMED") {
    return {
      ok: false,
      code: activity.lockedReason ?? "NOT_JOINABLE",
      message: "Activity not joinable",
    };
  }

  const periodKey = `activity:${activity.id}`;
  const idem = `${playerId}:${periodKey}`;
  const money = moneyService ?? createRouteMoneyService(db);

  const existing = await db.all<Record<string, unknown>>(sql`
    SELECT id, amount_minor, currency FROM activity_claims
    WHERE idempotency_key = ${idem} LIMIT 1
  `);
  if (existing[0]) {
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

  const playerRows = await db.all<{ currency: string; status: string }>(sql`
    SELECT currency, status FROM players WHERE id = ${playerId} LIMIT 1
  `);
  const player = playerRows[0];
  if (!player || player.status !== "ACTIVE") {
    return { ok: false, code: "PLAYER_UNAVAILABLE", message: "Player unavailable" };
  }
  if (String(player.currency) !== activity.currency) {
    return { ok: false, code: "CURRENCY_MISMATCH", message: "Activity currency mismatch" };
  }

  const ledgerKey = `activity:${idem}`;
  try {
    await money.credit({
      playerId,
      currency: activity.currency,
      amountMinor: activity.rewardMinor,
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
      INSERT INTO activity_claims
        ("id", "player_id", "activity_id", "idempotency_key", "period_key",
         "amount_minor", "currency", "status", "ledger_intent_key")
      VALUES (
        ${claimId}, ${playerId}, ${activity.id}, ${idem}, ${periodKey},
        ${activity.rewardMinor}, ${activity.currency}, 'CLAIMED', ${ledgerKey}
      )
    `);
  } catch {
    const bal = await money.getAvailableBalance(playerId, activity.currency);
    return {
      ok: true,
      alreadyClaimed: true,
      claimId,
      amountMinor: activity.rewardMinor,
      currency: activity.currency,
      balanceAfterMinor: bal,
    };
  }

  const balanceAfterMinor = await money.getAvailableBalance(playerId, activity.currency);
  return {
    ok: true,
    claimId,
    amountMinor: activity.rewardMinor,
    currency: activity.currency,
    balanceAfterMinor,
  };
}

export async function getCheckinStatus(
  db: AppDb,
  playerId: string,
): Promise<CheckinStatus> {
  await ensureWalletCommerceReady(db);
  const rows = await db.all<{ value_json: string }>(sql`
    SELECT value_json FROM wallet_commerce_config WHERE key = 'checkin' LIMIT 1
  `);
  const cfg = parseJson<{
    enabled?: boolean;
    rewardMinor?: number;
    currency?: string;
  }>(rows[0]?.value_json, {});
  const enabled = cfg.enabled !== false;
  const rewardMinor = Number(cfg.rewardMinor ?? 50);
  const currency = String(cfg.currency ?? "MMK");
  const dayKey = utcDayKey();
  const idem = `${playerId}:checkin:${dayKey}`;
  const claimedRows = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM checkin_claims WHERE idempotency_key = ${idem}
  `);
  const claimed = Number(claimedRows[0]?.n ?? 0) > 0;
  return {
    enabled,
    rewardMinor,
    currency,
    dayKey,
    claimed,
    claimable: enabled && !claimed && rewardMinor > 0,
  };
}

export async function claimCheckin(
  db: AppDb,
  playerId: string,
  moneyService?: ReturnType<typeof createRouteMoneyService>,
): Promise<ClaimActivityResult> {
  await ensureWalletCommerceReady(db);
  const status = await getCheckinStatus(db, playerId);
  const money = moneyService ?? createRouteMoneyService(db);
  const idem = `${playerId}:checkin:${status.dayKey}`;

  const existing = await db.all<Record<string, unknown>>(sql`
    SELECT id, amount_minor, currency FROM checkin_claims
    WHERE idempotency_key = ${idem} LIMIT 1
  `);
  if (existing[0]) {
    const bal = await money.getAvailableBalance(playerId, String(existing[0].currency));
    return {
      ok: true,
      alreadyClaimed: true,
      claimId: String(existing[0].id),
      amountMinor: Number(existing[0].amount_minor),
      currency: String(existing[0].currency),
      balanceAfterMinor: bal,
    };
  }

  if (!status.claimable) {
    return {
      ok: false,
      code: status.enabled ? "ALREADY_CLAIMED" : "DISABLED",
      message: status.enabled ? "Already checked in today" : "Check-in disabled",
    };
  }

  const playerRows = await db.all<{ currency: string; status: string }>(sql`
    SELECT currency, status FROM players WHERE id = ${playerId} LIMIT 1
  `);
  const player = playerRows[0];
  if (!player || player.status !== "ACTIVE") {
    return { ok: false, code: "PLAYER_UNAVAILABLE", message: "Player unavailable" };
  }
  if (String(player.currency) !== status.currency) {
    return { ok: false, code: "CURRENCY_MISMATCH", message: "Check-in currency mismatch" };
  }

  const ledgerKey = `checkin:${idem}`;
  try {
    await money.credit({
      playerId,
      currency: status.currency,
      amountMinor: status.rewardMinor,
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
      INSERT INTO checkin_claims
        ("id", "player_id", "day_key", "idempotency_key", "amount_minor", "currency",
         "status", "ledger_intent_key")
      VALUES (
        ${claimId}, ${playerId}, ${status.dayKey}, ${idem},
        ${status.rewardMinor}, ${status.currency}, 'CLAIMED', ${ledgerKey}
      )
    `);
  } catch {
    const bal = await money.getAvailableBalance(playerId, status.currency);
    return {
      ok: true,
      alreadyClaimed: true,
      claimId,
      amountMinor: status.rewardMinor,
      currency: status.currency,
      balanceAfterMinor: bal,
    };
  }

  const balanceAfterMinor = await money.getAvailableBalance(playerId, status.currency);
  return {
    ok: true,
    claimId,
    amountMinor: status.rewardMinor,
    currency: status.currency,
    balanceAfterMinor,
  };
}

export async function listAdminActivities(db: AppDb): Promise<ActivityView[]> {
  // Admin view without player claim flags — use synthetic player
  return listActivities(db, "__admin__");
}

export async function upsertActivity(
  db: AppDb,
  input: {
    id?: string;
    code: string;
    kind: string;
    title: Record<string, string>;
    body?: Record<string, string>;
    rewardMinor: number;
    currency?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    enabled?: boolean;
  },
): Promise<{ id: string }> {
  await ensureWalletCommerceReady(db);
  const id = input.id?.trim() || crypto.randomUUID();
  const enabled = input.enabled === false ? 0 : 1;
  await db.run(sql`
    INSERT INTO player_activities
      ("id", "code", "kind", "title_json", "body_json", "reward_minor", "currency",
       "starts_at", "ends_at", "enabled", "updated_at")
    VALUES (
      ${id},
      ${input.code},
      ${input.kind},
      ${JSON.stringify(input.title)},
      ${JSON.stringify(input.body ?? {})},
      ${input.rewardMinor},
      ${input.currency ?? "MMK"},
      ${input.startsAt ?? null},
      ${input.endsAt ?? null},
      ${enabled},
      ${new Date().toISOString().replace("T", " ").slice(0, 19)}
    )
    ON CONFLICT("id") DO UPDATE SET
      code = excluded.code,
      kind = excluded.kind,
      title_json = excluded.title_json,
      body_json = excluded.body_json,
      reward_minor = excluded.reward_minor,
      currency = excluded.currency,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      enabled = excluded.enabled,
      updated_at = excluded.updated_at
  `);
  return { id };
}

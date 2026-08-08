/**
 * VIP 1–6 — configurable levels + player VIP validity.
 * Unlock conditions are admin-configurable JSON — never hardcode screenshot amounts.
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";
import { ensurePlayerCommerceReady } from "./player-commerce-bootstrap.ts";

type AppDb = DrizzleD1Database<typeof schema>;

export type VipStatus = "ACTIVE" | "EXPIRED" | "PENDING" | "SUSPENDED";

export type VipLevelView = {
  level: number;
  code: string;
  title: Record<string, string>;
  conditions: Record<string, unknown>;
  enabled: boolean;
  unlocked: boolean;
  locked: boolean;
};

export type PlayerVipView = {
  playerId: string;
  level: number;
  status: VipStatus;
  vipStartedAt: string | null;
  vipExpiresAt: string | null;
  levels: VipLevelView[];
};

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function asVipStatus(value: string): VipStatus {
  if (value === "ACTIVE" || value === "EXPIRED" || value === "PENDING" || value === "SUSPENDED") {
    return value;
  }
  return "PENDING";
}

async function refreshExpiry(db: AppDb, playerId: string): Promise<void> {
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT level, status, vip_expires_at FROM player_vip WHERE player_id = ${playerId} LIMIT 1
  `);
  const row = rows[0];
  if (!row) return;
  const expires = row.vip_expires_at ? String(row.vip_expires_at) : null;
  const status = asVipStatus(String(row.status));
  if (status === "ACTIVE" && expires) {
    const expMs = Date.parse(expires.includes("T") ? expires : `${expires}Z`);
    if (Number.isFinite(expMs) && expMs < Date.now()) {
      await db.run(sql`
        UPDATE player_vip SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
        WHERE player_id = ${playerId}
      `);
    }
  }
}

export async function getPlayerVip(db: AppDb, playerId: string): Promise<PlayerVipView> {
  await ensurePlayerCommerceReady(db);
  await db.run(sql`
    INSERT INTO player_vip ("player_id", "level", "status")
    VALUES (${playerId}, 0, 'PENDING')
    ON CONFLICT("player_id") DO NOTHING
  `);
  await refreshExpiry(db, playerId);

  const vipRows = await db.all<Record<string, unknown>>(sql`
    SELECT level, status, vip_started_at, vip_expires_at
    FROM player_vip WHERE player_id = ${playerId} LIMIT 1
  `);
  const vip = vipRows[0];
  const level = Number(vip?.level ?? 0);
  const status = asVipStatus(String(vip?.status ?? "PENDING"));

  const levelRows = await db.all<Record<string, unknown>>(sql`
    SELECT level, code, title_json, conditions_json, enabled, sort_order
    FROM vip_level_config
    ORDER BY sort_order ASC, level ASC
  `);

  const levels: VipLevelView[] = levelRows.map((row) => {
    const lv = Number(row.level);
    const unlocked = status === "ACTIVE" && level >= lv;
    return {
      level: lv,
      code: String(row.code),
      title: parseJson(row.title_json, {}),
      conditions: parseJson(row.conditions_json, {}),
      enabled: Number(row.enabled) === 1,
      unlocked,
      locked: !unlocked,
    };
  });

  return {
    playerId,
    level,
    status,
    vipStartedAt: vip?.vip_started_at ? String(vip.vip_started_at) : null,
    vipExpiresAt: vip?.vip_expires_at ? String(vip.vip_expires_at) : null,
    levels,
  };
}

/** Admin / ops: set VIP level + validity. Does not credit wallet. */
export async function setPlayerVip(
  db: AppDb,
  playerId: string,
  input: {
    level: number;
    status: VipStatus;
    vipStartedAt?: string | null;
    vipExpiresAt?: string | null;
  },
): Promise<PlayerVipView> {
  await ensurePlayerCommerceReady(db);
  if (input.level < 0 || input.level > 6) {
    throw new Error("VIP level must be 0–6");
  }
  const started =
    input.vipStartedAt ??
    (input.status === "ACTIVE" ? new Date().toISOString().slice(0, 19).replace("T", " ") : null);
  const expires = input.vipExpiresAt ?? null;
  await db.run(sql`
    INSERT INTO player_vip ("player_id", "level", "status", "vip_started_at", "vip_expires_at", "updated_at")
    VALUES (${playerId}, ${input.level}, ${input.status}, ${started}, ${expires}, CURRENT_TIMESTAMP)
    ON CONFLICT("player_id") DO UPDATE SET
      level = excluded.level,
      status = excluded.status,
      vip_started_at = excluded.vip_started_at,
      vip_expires_at = excluded.vip_expires_at,
      updated_at = CURRENT_TIMESTAMP
  `);
  return getPlayerVip(db, playerId);
}

export async function listVipLevelConfig(db: AppDb) {
  await ensurePlayerCommerceReady(db);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT level, code, title_json, conditions_json, enabled, sort_order, updated_at
    FROM vip_level_config ORDER BY sort_order ASC, level ASC
  `);
  return rows.map((row) => ({
    level: Number(row.level),
    code: String(row.code),
    title: parseJson(row.title_json, {}),
    conditions: parseJson(row.conditions_json, {}),
    enabled: Number(row.enabled) === 1,
    sortOrder: Number(row.sort_order ?? 0),
    updatedAt: String(row.updated_at ?? ""),
  }));
}

export async function upsertVipLevelConfig(
  db: AppDb,
  input: {
    level: number;
    code: string;
    title: Record<string, string>;
    conditions: Record<string, unknown>;
    enabled: boolean;
  },
): Promise<void> {
  await ensurePlayerCommerceReady(db);
  if (input.level < 1 || input.level > 6) throw new Error("level must be 1–6");
  await db.run(sql`
    INSERT INTO vip_level_config
      ("level", "code", "title_json", "conditions_json", "enabled", "sort_order", "updated_at")
    VALUES (
      ${input.level},
      ${input.code},
      ${JSON.stringify(input.title)},
      ${JSON.stringify(input.conditions)},
      ${input.enabled ? 1 : 0},
      ${input.level},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT("level") DO UPDATE SET
      code = excluded.code,
      title_json = excluded.title_json,
      conditions_json = excluded.conditions_json,
      enabled = excluded.enabled,
      updated_at = CURRENT_TIMESTAMP
  `);
}

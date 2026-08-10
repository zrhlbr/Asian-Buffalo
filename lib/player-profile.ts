/**
 * Player profile sidecar — nickname / avatar / phone.
 * Never mutates wallet balance. Phone SMS OTP is BR-004 PENDING (format stub).
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";
import {
  AVATAR_IDS,
  ensurePlayerCommerceReady,
  isAvatarId,
  type AvatarId,
} from "./player-commerce-bootstrap.ts";

type AppDb = DrizzleD1Database<typeof schema>;

export const SUPPORTED_DISPLAY_CURRENCIES = ["MMK", "THB", "USD"] as const;

export type PlayerProfileView = {
  playerId: string;
  nickname: string;
  avatarId: AvatarId;
  avatarUrl: string;
  phoneMasked: string | null;
  phoneE164: string | null;
  phoneVerified: boolean;
  currency: string;
  supportedCurrencies: readonly string[];
  status: string;
  registeredAt: string;
  lastLoginAt: string | null;
  vipLevel: number;
  vipStatus: string;
  vipBadge: string | null;
};

function avatarUrl(avatarId: string): string {
  return `/avatars/${avatarId}.svg`;
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `****${digits.slice(-4)}`;
}

/** Loose E.164: + then 8–15 digits. No SMS send (BR-004). */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone.trim());
}

export function isValidNickname(nickname: string): boolean {
  const n = nickname.trim();
  if (n.length < 2 || n.length > 24) return false;
  return /^[\p{L}\p{N}_\-.\u1000-\u109F ]+$/u.test(n);
}

async function ensureRow(db: AppDb, playerId: string): Promise<void> {
  await ensurePlayerCommerceReady(db);
  const nick = `Player_${playerId.slice(-6)}`;
  await db.run(sql`
    INSERT INTO player_profiles ("player_id", "nickname", "avatar_id", "last_login_at")
    VALUES (${playerId}, ${nick}, 'ab-avatar-01', CURRENT_TIMESTAMP)
    ON CONFLICT("player_id") DO NOTHING
  `);
  await db.run(sql`
    INSERT INTO player_vip ("player_id", "level", "status")
    VALUES (${playerId}, 0, 'PENDING')
    ON CONFLICT("player_id") DO NOTHING
  `);
}

export async function getPlayerProfile(
  db: AppDb,
  playerId: string,
): Promise<PlayerProfileView | null> {
  await ensureRow(db, playerId);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT p.id AS player_id, p.currency, p.status AS player_status,
           pf.nickname, pf.avatar_id, pf.phone_e164, pf.phone_verified,
           pf.status AS profile_status, pf.registered_at, pf.last_login_at,
           COALESCE(v.level, 0) AS vip_level,
           COALESCE(v.status, 'PENDING') AS vip_status,
           vc.code AS vip_badge
    FROM players p
    LEFT JOIN player_profiles pf ON pf.player_id = p.id
    LEFT JOIN player_vip v ON v.player_id = p.id
    LEFT JOIN vip_level_config vc ON vc.level = v.level AND vc.enabled = 1
    WHERE p.id = ${playerId}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  const avatarId = isAvatarId(String(row.avatar_id ?? "ab-avatar-01"))
    ? (String(row.avatar_id) as AvatarId)
    : "ab-avatar-01";
  const phone = row.phone_e164 ? String(row.phone_e164) : null;
  return {
    playerId: String(row.player_id),
    nickname: String(row.nickname ?? ""),
    avatarId,
    avatarUrl: avatarUrl(avatarId),
    phoneMasked: maskPhone(phone),
    phoneE164: phone,
    phoneVerified: Number(row.phone_verified ?? 0) === 1,
    currency: String(row.currency),
    supportedCurrencies: SUPPORTED_DISPLAY_CURRENCIES,
    status: String(row.player_status ?? row.profile_status ?? "ACTIVE"),
    registeredAt: String(row.registered_at ?? ""),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
    vipLevel: Number(row.vip_level ?? 0),
    vipStatus: String(row.vip_status ?? "PENDING"),
    vipBadge: row.vip_badge ? String(row.vip_badge) : null,
  };
}

export async function touchLastLogin(db: AppDb, playerId: string): Promise<void> {
  await ensureRow(db, playerId);
  await db.run(sql`
    UPDATE player_profiles
    SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE player_id = ${playerId}
  `);
}

export async function updateNickname(
  db: AppDb,
  playerId: string,
  nickname: string,
): Promise<{ ok: true; profile: PlayerProfileView } | { ok: false; code: string; message: string }> {
  if (!isValidNickname(nickname)) {
    return { ok: false, code: "INVALID_NICKNAME", message: "Nickname must be 2–24 letters/numbers" };
  }
  await ensureRow(db, playerId);
  await db.run(sql`
    UPDATE player_profiles
    SET nickname = ${nickname.trim()}, updated_at = CURRENT_TIMESTAMP
    WHERE player_id = ${playerId}
  `);
  const profile = await getPlayerProfile(db, playerId);
  if (!profile) return { ok: false, code: "PLAYER_UNAVAILABLE", message: "Player unavailable" };
  return { ok: true, profile };
}

export async function updateAvatar(
  db: AppDb,
  playerId: string,
  avatarId: string,
): Promise<{ ok: true; profile: PlayerProfileView } | { ok: false; code: string; message: string }> {
  if (!isAvatarId(avatarId)) {
    return { ok: false, code: "INVALID_AVATAR", message: "Unknown avatarId" };
  }
  await ensureRow(db, playerId);
  await db.run(sql`
    UPDATE player_profiles
    SET avatar_id = ${avatarId}, updated_at = CURRENT_TIMESTAMP
    WHERE player_id = ${playerId}
  `);
  const profile = await getPlayerProfile(db, playerId);
  if (!profile) return { ok: false, code: "PLAYER_UNAVAILABLE", message: "Player unavailable" };
  return { ok: true, profile };
}

/**
 * Phone bind/update stub — validates E.164, stores value, marks unverified.
 * SMS OTP vendor path is BUSINESS_RULES_PENDING BR-004.
 */
export async function updatePhone(
  db: AppDb,
  playerId: string,
  phoneE164: string,
): Promise<{ ok: true; profile: PlayerProfileView } | { ok: false; code: string; message: string }> {
  const phone = phoneE164.trim();
  if (!isValidE164(phone)) {
    return { ok: false, code: "INVALID_PHONE", message: "Phone must be E.164 (+country…)" };
  }
  await ensureRow(db, playerId);
  await db.run(sql`
    UPDATE player_profiles
    SET phone_e164 = ${phone}, phone_verified = 0, updated_at = CURRENT_TIMESTAMP
    WHERE player_id = ${playerId}
  `);
  const profile = await getPlayerProfile(db, playerId);
  if (!profile) return { ok: false, code: "PLAYER_UNAVAILABLE", message: "Player unavailable" };
  return { ok: true, profile };
}

export function listAvatarCatalog(): Array<{ id: AvatarId; url: string }> {
  return AVATAR_IDS.map((id) => ({ id, url: avatarUrl(id) }));
}

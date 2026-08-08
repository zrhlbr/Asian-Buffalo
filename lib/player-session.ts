/**
 * Player access + refresh session cookies (opaque tokens, hashed at rest).
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";
import { ensurePlayerAuthReady } from "./player-auth-bootstrap.ts";

type AppDb = DrizzleD1Database<typeof schema>;

export const PLAYER_ACCESS_COOKIE = "ab_player";
export const PLAYER_REFRESH_COOKIE = "ab_player_rt";
export const ACCESS_TTL_MS = 2 * 60 * 60 * 1000; // 2h
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateOpaqueToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function hashToken(token: string): Promise<string> {
  const dig = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`sess:${token}`));
  return toHex(dig);
}

function newSessionId(): string {
  return `ps_${generateOpaqueToken().slice(0, 24)}`;
}

export function extractCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) {
      const value = rest.join("=").trim();
      if (value.length > 0) return value;
    }
  }
  return null;
}

export function extractPlayerAccessToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token.length > 0) return token;
  }
  return extractCookie(request, PLAYER_ACCESS_COOKIE);
}

export function extractClientDevice(request: Request): string {
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua) return "unknown";
  const clipped = ua.slice(0, 160);
  if (/Mobile|Android|iPhone/i.test(clipped)) return `mobile:${clipped.slice(0, 80)}`;
  if (/iPad|Tablet/i.test(clipped)) return `tablet:${clipped.slice(0, 80)}`;
  return `desktop:${clipped.slice(0, 80)}`;
}

export function extractClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function cookieFlags(maxAgeSec: number): string {
  const secure =
    typeof process !== "undefined" && process.env.NODE_ENV === "production"
      ? "; Secure"
      : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

export function buildSessionSetCookies(accessToken: string, refreshToken: string): string[] {
  return [
    `${PLAYER_ACCESS_COOKIE}=${accessToken}; ${cookieFlags(Math.floor(ACCESS_TTL_MS / 1000))}`,
    `${PLAYER_REFRESH_COOKIE}=${refreshToken}; ${cookieFlags(Math.floor(REFRESH_TTL_MS / 1000))}`,
  ];
}

export function buildSessionClearCookies(): string[] {
  return [
    `${PLAYER_ACCESS_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${PLAYER_REFRESH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  ];
}

export type CreatedSession = {
  sessionId: string;
  playerId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  refreshExpiresAt: string;
};

export async function createPlayerSession(
  db: AppDb,
  input: {
    playerId: string;
    ip: string;
    device: string;
    userAgent: string;
  },
): Promise<CreatedSession> {
  await ensurePlayerAuthReady(db);
  const accessToken = generateOpaqueToken();
  const refreshToken = generateOpaqueToken();
  const accessHash = await hashToken(accessToken);
  const refreshHash = await hashToken(refreshToken);
  const sessionId = newSessionId();
  const now = Date.now();
  const expiresAt = new Date(now + ACCESS_TTL_MS).toISOString();
  const refreshExpiresAt = new Date(now + REFRESH_TTL_MS).toISOString();

  await db.run(sql`
    INSERT INTO player_auth_sessions
      ("id", "player_id", "access_token_hash", "refresh_token_hash",
       "ip", "device", "user_agent", "expires_at", "refresh_expires_at")
    VALUES (
      ${sessionId}, ${input.playerId}, ${accessHash}, ${refreshHash},
      ${input.ip}, ${input.device}, ${input.userAgent.slice(0, 240)},
      ${expiresAt}, ${refreshExpiresAt}
    )
  `);

  return {
    sessionId,
    playerId: input.playerId,
    accessToken,
    refreshToken,
    expiresAt,
    refreshExpiresAt,
  };
}

export type ResolvedPlayerSession = {
  sessionId: string;
  playerId: string;
  ip: string | null;
  device: string | null;
};

export async function resolvePlayerSession(
  db: AppDb,
  request: Request,
): Promise<ResolvedPlayerSession | null> {
  await ensurePlayerAuthReady(db);
  const token = extractPlayerAccessToken(request);
  if (!token) return null;
  const accessHash = await hashToken(token);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT id, player_id, ip, device, expires_at, revoked_at
    FROM player_auth_sessions
    WHERE access_token_hash = ${accessHash}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  if (row.revoked_at) return null;
  if (Date.parse(String(row.expires_at)) <= Date.now()) return null;

  await db.run(sql`
    UPDATE player_auth_sessions
    SET last_seen_at = CURRENT_TIMESTAMP
    WHERE id = ${String(row.id)}
  `);

  return {
    sessionId: String(row.id),
    playerId: String(row.player_id),
    ip: row.ip ? String(row.ip) : null,
    device: row.device ? String(row.device) : null,
  };
}

export async function refreshPlayerSession(
  db: AppDb,
  request: Request,
): Promise<CreatedSession | null> {
  await ensurePlayerAuthReady(db);
  const refreshToken = extractCookie(request, PLAYER_REFRESH_COOKIE);
  if (!refreshToken) return null;
  const refreshHash = await hashToken(refreshToken);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT id, player_id, refresh_expires_at, revoked_at, ip, device, user_agent
    FROM player_auth_sessions
    WHERE refresh_token_hash = ${refreshHash}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row || row.revoked_at) return null;
  if (Date.parse(String(row.refresh_expires_at)) <= Date.now()) return null;

  // Rotate: revoke old, create new
  await db.run(sql`
    UPDATE player_auth_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE id = ${String(row.id)}
  `);

  return createPlayerSession(db, {
    playerId: String(row.player_id),
    ip: extractClientIp(request),
    device: extractClientDevice(request),
    userAgent: request.headers.get("user-agent") ?? String(row.user_agent ?? ""),
  });
}

export async function revokePlayerSession(
  db: AppDb,
  request: Request,
): Promise<string | null> {
  await ensurePlayerAuthReady(db);
  const token = extractPlayerAccessToken(request);
  if (!token) return null;
  const accessHash = await hashToken(token);
  const rows = await db.all<{ id: string; player_id: string }>(sql`
    SELECT id, player_id FROM player_auth_sessions
    WHERE access_token_hash = ${accessHash} LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  await db.run(sql`
    UPDATE player_auth_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE id = ${row.id}
  `);
  return row.player_id;
}

export async function revokeAllPlayerSessions(db: AppDb, playerId: string): Promise<void> {
  await ensurePlayerAuthReady(db);
  await db.run(sql`
    UPDATE player_auth_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE player_id = ${playerId} AND revoked_at IS NULL
  `);
}

export async function listPlayerSessions(db: AppDb, playerId: string) {
  await ensurePlayerAuthReady(db);
  return db.all<Record<string, unknown>>(sql`
    SELECT id, ip, device, created_at, last_seen_at, expires_at, revoked_at
    FROM player_auth_sessions
    WHERE player_id = ${playerId}
    ORDER BY created_at DESC
    LIMIT 20
  `);
}

/** Latest non-revoked session meta for admin visibility. */
export async function getLatestSessionMeta(
  db: AppDb,
  playerId: string,
): Promise<{ ip: string | null; device: string | null; lastSeenAt: string | null } | null> {
  await ensurePlayerAuthReady(db);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT ip, device, last_seen_at
    FROM player_auth_sessions
    WHERE player_id = ${playerId}
    ORDER BY COALESCE(last_seen_at, created_at) DESC
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    ip: row.ip ? String(row.ip) : null,
    device: row.device ? String(row.device) : null,
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
  };
}

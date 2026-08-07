/**
 * R1-M7 Admin console — RBAC roles, permissions, password hashing and
 * admin-session handling.
 *
 * Admin identity is fully independent from player identity
 * (lib/identity.ts). Passwords are stored as salted SHA-256 digests via Web
 * Crypto (available in both the Workers runtime and Node >= 20). Sessions
 * are opaque random tokens persisted in `admin_sessions` with an expiry.
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import { sql } from "drizzle-orm";
import type * as schema from "../../db/schema.ts";

// ---------------------------------------------------------------------------
// Roles & permissions
// ---------------------------------------------------------------------------

export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "OPS",
  "SUPPORT",
  "FINANCE",
  "RISK",
  "AUDIT",
  "TECH",
  "READONLY",
] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  "dashboard:view",
  "players:view",
  "players:freeze",
  "rounds:view",
  "wallet:view",
  "ledger:view",
  "math:view",
  "risk:view",
  "system:view",
  "system:manage",
  "logs:view",
  "admins:view",
  "admins:manage",
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const ALL_VIEW: AdminPermission[] = [
  "dashboard:view",
  "players:view",
  "rounds:view",
  "wallet:view",
  "ledger:view",
  "math:view",
  "risk:view",
  "system:view",
  "logs:view",
  "admins:view",
];

<<<<<<< Updated upstream
const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[] | "*"> = {
=======
export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[] | "*"> = {
>>>>>>> Stashed changes
  SUPER_ADMIN: "*",
  OPS: [
    "dashboard:view",
    "players:view",
    "players:freeze",
    "rounds:view",
    "risk:view",
    "system:view",
    "system:manage",
    "logs:view",
  ],
  SUPPORT: ["dashboard:view", "players:view", "rounds:view", "wallet:view"],
  FINANCE: ["dashboard:view", "wallet:view", "ledger:view", "rounds:view", "logs:view"],
  RISK: [
    "dashboard:view",
    "risk:view",
    "players:view",
    "players:freeze",
    "rounds:view",
    "logs:view",
  ],
  AUDIT: [...ALL_VIEW],
  TECH: ["dashboard:view", "system:view", "system:manage", "math:view", "logs:view"],
  READONLY: [...ALL_VIEW],
};

export function roleHasPermission(role: AdminRole, permission: AdminPermission): boolean {
  const grants = ROLE_PERMISSIONS[role];
  if (grants === "*") return true;
  return grants.includes(permission);
}

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Password hashing (salted SHA-256, Web Crypto)
// ---------------------------------------------------------------------------

const hexEncoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

export async function hashAdminPassword(password: string, salt: string): Promise<string> {
  // Iterated salted SHA-256 (100_000 rounds) — dependency-free and available
  // in both Workers and Node. Not as strong as scrypt/argon2; documented in
  // the risk analysis deliverable.
  let digest = hexEncoder.encode(`${salt}:${password}`);
  for (let round = 0; round < 100_000; round += 1) {
    digest = new Uint8Array(await crypto.subtle.digest("SHA-256", digest));
  }
  return toHex(digest.buffer as ArrayBuffer);
}

export function generateAdminToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

// ---------------------------------------------------------------------------
// Admin session resolution
// ---------------------------------------------------------------------------

export type AdminIdentity = {
  adminId: string;
  username: string;
  role: AdminRole;
};

export type AdminSessionRow = {
  adminId: string;
  username: string;
  role: string;
  status: string;
  expiresAt: string;
};

export const ADMIN_SESSION_COOKIE = "ab_admin";
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

export function extractAdminToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token.length > 0) return token;
  }
  const cookie = request.headers.get("cookie");
  if (cookie) {
    for (const part of cookie.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === ADMIN_SESSION_COOKIE) {
        const value = rest.join("=").trim();
        if (value.length > 0) return value;
      }
    }
  }
  return null;
}

/**
 * Resolve the admin identity for a request. Returns null when the session is
 * missing, expired, or the admin is disabled.
 */
export async function resolveAdminIdentity(
  db: DrizzleD1Database<typeof schema>,
  request: Request,
): Promise<AdminIdentity | null> {
  const token = extractAdminToken(request);
  if (!token) return null;
  const rows = await db.all<AdminSessionRow>(sql`
    SELECT s.admin_id AS adminId, u.username AS username, u.role AS role,
           u.status AS status, s.expires_at AS expiresAt
    FROM admin_sessions s
    JOIN admin_users u ON u.id = s.admin_id
    WHERE s.token = ${token}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  if (row.status !== "ACTIVE") return null;
  if (new Date(row.expiresAt.replace(" ", "T") + "Z").getTime() <= Date.now()) return null;
  if (!isAdminRole(row.role)) return null;
  return { adminId: row.adminId, username: row.username, role: row.role };
}

/** Best-effort client IP for audit records. */
export function extractClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

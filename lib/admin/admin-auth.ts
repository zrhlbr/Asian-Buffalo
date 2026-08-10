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
  "players:pii:view",
  "players:sessions:view",
  "players:devices:view",
  "players:session:revoke",
  "rounds:view",
  "wallet:view",
  "wallet:integrity:view",
  "ledger:view",
  "math:view",
  "risk:view",
  "risk:manage",
  "risk:pii:view",
  "system:view",
  "system:manage",
  "content:view",
  "content:edit",
  "content:publish",
  "logs:view",
  "admins:view",
  "admins:manage",
  "admins:sessions:view",
  "admins:sessions:revoke",
  "security:view",
  "support:view",
  "support:reply",
  "support:assign",
  "support:manage",
  "vip:view",
  "vip:manage",
  "deposit:view",
  "deposit:manage",
  "withdraw:view",
  "withdraw:review",
  "withdraw:pay",
  "activity:view",
  "activity:manage",
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const ALL_VIEW: AdminPermission[] = [
  "dashboard:view",
  "players:view",
  "players:sessions:view",
  "players:devices:view",
  "rounds:view",
  "wallet:view",
  "wallet:integrity:view",
  "ledger:view",
  "math:view",
  "risk:view",
  "system:view",
  "content:view",
  "logs:view",
  "admins:view",
  "security:view",
  "support:view",
  "vip:view",
  "deposit:view",
  "withdraw:view",
  "activity:view",
];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[] | "*"> = {
  SUPER_ADMIN: "*",
  OPS: [
    "dashboard:view",
    "players:view",
    "players:freeze",
    "players:sessions:view",
    // OPS: sessions list OK; no full PII / raw IP-device by default (S-19).
    "players:session:revoke",
    "rounds:view",
    "risk:view",
    "system:view",
    "system:manage",
    "content:view",
    "content:edit",
    "content:publish",
    "logs:view",
    "vip:view",
    "vip:manage",
    "deposit:view",
    "deposit:manage",
    "withdraw:view",
    "withdraw:review",
    "activity:view",
    "activity:manage",
    "support:view",
    "support:reply",
    "support:assign",
    "support:manage",
    "admins:sessions:view",
    "security:view",
  ],
  SUPPORT: [
    "dashboard:view",
    "players:view",
    "players:sessions:view",
    "rounds:view",
    "wallet:view",
    "vip:view",
    "content:view",
    "deposit:view",
    "withdraw:view",
    "activity:view",
    "support:view",
    "support:reply",
    "support:assign",
    "support:manage",
  ],
  FINANCE: [
    "dashboard:view",
    "wallet:view",
    "wallet:integrity:view",
    "ledger:view",
    "rounds:view",
    "risk:view",
    "logs:view",
    "vip:view",
    "deposit:view",
    "deposit:manage",
    "withdraw:view",
    "withdraw:review",
    "withdraw:pay",
    "activity:view",
  ],
  RISK: [
    "dashboard:view",
    "risk:view",
    "risk:manage",
    "risk:pii:view",
    "players:view",
    "players:freeze",
    "players:pii:view",
    "players:sessions:view",
    "players:devices:view",
    "players:session:revoke",
    "rounds:view",
    "wallet:view",
    "wallet:integrity:view",
    "ledger:view",
    "logs:view",
    "vip:view",
    "withdraw:view",
    "withdraw:review",
    "deposit:view",
  ],
  AUDIT: [...ALL_VIEW, "players:pii:view"],
  TECH: [
    "dashboard:view",
    "system:view",
    "system:manage",
    "content:view",
    "content:edit",
    "content:publish",
    "math:view",
    "logs:view",
    "vip:view",
    "activity:view",
    "activity:manage",
  ],
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

/** Actor may grant role only if equal-or-lower privilege; only SUPER may grant SUPER. */
export function canGrantRole(actorRole: AdminRole, targetRole: AdminRole): boolean {
  if (actorRole === "SUPER_ADMIN") return true;
  if (targetRole === "SUPER_ADMIN") return false;
  // Non-SUPER with admins:manage (future) still cannot escalate beyond own role.
  return actorRole === targetRole || ROLE_RANK[targetRole] < ROLE_RANK[actorRole];
}

const ROLE_RANK: Record<AdminRole, number> = {
  READONLY: 1,
  SUPPORT: 2,
  AUDIT: 3,
  TECH: 3,
  FINANCE: 4,
  OPS: 5,
  RISK: 5,
  SUPER_ADMIN: 99,
};

export function permissionsForRole(role: AdminRole): AdminPermission[] {
  const grants = ROLE_PERMISSIONS[role];
  if (grants === "*") return [...ADMIN_PERMISSIONS];
  return [...grants];
}

export function permissionModules(): Record<string, AdminPermission[]> {
  const groups: Record<string, AdminPermission[]> = {
    Dashboard: [],
    Players: [],
    Games: [],
    Rounds: [],
    Spins: [],
    Wallet: [],
    Ledger: [],
    Deposit: [],
    Withdrawal: [],
    Risk: [],
    Audit: [],
    Content: [],
    Activity: [],
    VIP: [],
    CustomerService: [],
    AdminUsers: [],
    Roles: [],
    System: [],
    Security: [],
  };
  for (const perm of ADMIN_PERMISSIONS) {
    if (perm.startsWith("dashboard:")) groups.Dashboard.push(perm);
    else if (perm.startsWith("players:")) groups.Players.push(perm);
    else if (perm.startsWith("rounds:")) {
      groups.Games.push(perm);
      groups.Rounds.push(perm);
      groups.Spins.push(perm);
    } else if (perm.startsWith("wallet:")) groups.Wallet.push(perm);
    else if (perm.startsWith("ledger:")) groups.Ledger.push(perm);
    else if (perm.startsWith("deposit:")) groups.Deposit.push(perm);
    else if (perm.startsWith("withdraw:")) groups.Withdrawal.push(perm);
    else if (perm.startsWith("risk:")) groups.Risk.push(perm);
    else if (perm.startsWith("logs:")) groups.Audit.push(perm);
    else if (perm.startsWith("content:")) groups.Content.push(perm);
    else if (perm.startsWith("activity:")) groups.Activity.push(perm);
    else if (perm.startsWith("vip:")) groups.VIP.push(perm);
    else if (perm.startsWith("support:")) groups.CustomerService.push(perm);
    else if (perm.startsWith("admins:")) {
      groups.AdminUsers.push(perm);
      groups.Roles.push(perm);
    } else if (perm.startsWith("security:")) groups.Security.push(perm);
    else if (perm.startsWith("system:") || perm.startsWith("math:")) groups.System.push(perm);
  }
  return groups;
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

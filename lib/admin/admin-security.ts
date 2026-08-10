/**
 * ADMIN-1G Admin sessions + security summary (extends existing admin_sessions).
 */

import { sql } from "drizzle-orm";
import type { AdminDb } from "./admin-queries.ts";
import { maskIp } from "./admin-pii.ts";
import { ADMIN_ROLES, permissionsForRole, type AdminRole } from "./admin-auth.ts";

function maskSessionId(token: string): string {
  if (token.length <= 10) return "***";
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function deviceSummary(ua: string | null): string {
  if (!ua) return "unknown";
  const s = ua.slice(0, 80);
  return s.length < ua.length ? `${s}…` : s;
}

export type AdminSessionView = {
  sessionIdMasked: string;
  tokenFingerprint: string;
  adminId: string;
  username: string;
  role: string;
  ipMasked: string | null;
  device: string;
  createdAt: string;
  expiresAt: string;
  status: "ACTIVE" | "EXPIRED";
  isSelf: boolean;
};

export async function listAdminSessions(
  db: AdminDb,
  opts: { adminId?: string; viewerAdminId: string; page?: number; pageSize?: number },
): Promise<{ items: AdminSessionView[]; page: number; pageSize: number; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  const rows = opts.adminId
    ? await db.all<Record<string, unknown>>(sql`
        SELECT s.token, s.admin_id, s.ip, s.user_agent, s.created_at, s.expires_at,
               u.username, u.role
        FROM admin_sessions s
        JOIN admin_users u ON u.id = s.admin_id
        WHERE s.admin_id = ${opts.adminId}
        ORDER BY s.created_at DESC
        LIMIT 200
      `)
    : await db.all<Record<string, unknown>>(sql`
        SELECT s.token, s.admin_id, s.ip, s.user_agent, s.created_at, s.expires_at,
               u.username, u.role
        FROM admin_sessions s
        JOIN admin_users u ON u.id = s.admin_id
        ORDER BY s.created_at DESC
        LIMIT 200
      `);
  const now = Date.now();
  const items = rows.map((row) => {
    const token = String(row.token);
    const exp = Date.parse(String(row.expires_at).replace(" ", "T") + "Z");
    const expired = Number.isFinite(exp) && exp <= now;
    return {
      sessionIdMasked: maskSessionId(token),
      tokenFingerprint: token.slice(0, 16),
      adminId: String(row.admin_id),
      username: String(row.username),
      role: String(row.role),
      ipMasked: maskIp(row.ip ? String(row.ip) : null),
      device: deviceSummary(row.user_agent ? String(row.user_agent) : null),
      createdAt: String(row.created_at),
      expiresAt: String(row.expires_at),
      status: (expired ? "EXPIRED" : "ACTIVE") as "ACTIVE" | "EXPIRED",
      isSelf: String(row.admin_id) === opts.viewerAdminId,
    };
  });
  const total = items.length;
  return { items: items.slice(offset, offset + pageSize), page, pageSize, total };
}

export async function revokeAdminSessionByFingerprint(
  db: AdminDb,
  fingerprint: string,
  opts: { actorAdminId: string; allowAny: boolean },
): Promise<{ ok: true; adminId: string } | { ok: false; code: string; message: string }> {
  if (!fingerprint || fingerprint.length < 8) {
    return { ok: false, code: "INVALID_REQUEST", message: "session fingerprint required" };
  }
  const rows = await db.all<{ token: string; admin_id: string }>(sql`
    SELECT token, admin_id FROM admin_sessions WHERE token LIKE ${`${fingerprint}%`} LIMIT 2
  `);
  if (rows.length === 0) return { ok: false, code: "NOT_FOUND", message: "session not found" };
  if (rows.length > 1) return { ok: false, code: "AMBIGUOUS", message: "session fingerprint ambiguous" };
  const row = rows[0];
  if (!opts.allowAny && row.admin_id !== opts.actorAdminId) {
    return { ok: false, code: "FORBIDDEN", message: "cannot revoke other admin sessions" };
  }
  await db.run(sql`DELETE FROM admin_sessions WHERE token = ${row.token}`);
  return { ok: true, adminId: row.admin_id };
}

export async function revokeOtherSessionsForAdmin(
  db: AdminDb,
  adminId: string,
  keepToken: string | null,
): Promise<number> {
  if (keepToken) {
    await db.run(sql`
      DELETE FROM admin_sessions WHERE admin_id = ${adminId} AND token != ${keepToken}
    `);
  } else {
    await db.run(sql`DELETE FROM admin_sessions WHERE admin_id = ${adminId}`);
  }
  const left = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM admin_sessions WHERE admin_id = ${adminId}
  `);
  return Number(left[0]?.n ?? 0);
}

export async function countActiveSuperAdmins(db: AdminDb): Promise<number> {
  const rows = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM admin_users
    WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE'
  `);
  return Number(rows[0]?.n ?? 0);
}

export async function getAdminSecurityOverview(db: AdminDb) {
  const activeSessions = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM admin_sessions
    WHERE datetime(expires_at) > datetime('now')
  `);
  const disabledAdmins = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM admin_users WHERE status = 'DISABLED'
  `);
  const supers = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM admin_users WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE'
  `);
  const recentPerm = await db.all<Record<string, unknown>>(sql`
    SELECT id, admin_username, action, target_id, reason, created_at, request_id
    FROM admin_audit_logs
    WHERE action IN (
      'admin.create', 'admin.disable', 'admin.enable', 'admin.change_role',
      'admin.reset_password', 'admin.session.revoke', 'admin.sessions.logout_others'
    )
    ORDER BY created_at DESC LIMIT 20
  `);
  return {
    adminLoginFailures: {
      value: null,
      availability: "NOT_AVAILABLE" as const,
      source: "failed login not persisted",
    },
    activeSessions: Number(activeSessions[0]?.n ?? 0),
    revokedSessionsNote: "Revoke deletes session rows; historical revoke count via audit only",
    disabledAdmins: Number(disabledAdmins[0]?.n ?? 0),
    highPrivilegeRoles: {
      SUPER_ADMIN: Number(supers[0]?.n ?? 0),
    },
    recentPermissionChanges: recentPerm.map((row) => ({
      id: String(row.id),
      operator: String(row.admin_username ?? ""),
      action: String(row.action),
      targetId: row.target_id ? String(row.target_id) : null,
      reason: row.reason ? String(row.reason) : null,
      createdAt: String(row.created_at),
      requestId: row.request_id ? String(row.request_id) : null,
    })),
    bootstrap: {
      envVar: "AB_ADMIN_BOOTSTRAP_PASSWORD",
      passwordExposed: false,
      note: "Used only when admin_users empty; never returned by API/UI",
    },
  };
}

export async function listRoleCatalog(db: AdminDb) {
  const counts = await db.all<{ role: string; n: number }>(sql`
    SELECT role, COUNT(*) AS n FROM admin_users GROUP BY role
  `);
  const byRole: Record<string, number> = {};
  for (const row of counts) byRole[String(row.role)] = Number(row.n);
  return ADMIN_ROLES.map((role) => {
    const perms = permissionsForRole(role as AdminRole);
    return {
      roleId: role,
      roleName: role,
      description: role === "SUPER_ADMIN" ? "Full privilege — audited" : `Static role ${role}`,
      adminCount: byRole[role] ?? 0,
      permissionCount: perms.length,
      status: "ACTIVE",
      permissions: perms,
      editable: false,
      note: "Roles are static ROLE_PERMISSIONS map — no DB role editor in ADMIN-1G",
    };
  });
}

export async function getAdminUserDetail(db: AdminDb, adminId: string) {
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT id, username, display_name, role, status, last_login_at, created_at, updated_at
    FROM admin_users WHERE id = ${adminId} LIMIT 1
  `);
  if (!rows[0]) return null;
  const role = String(rows[0].role) as AdminRole;
  const sessions = await listAdminSessions(db, {
    adminId,
    viewerAdminId: adminId,
    page: 1,
    pageSize: 50,
  });
  return {
    id: String(rows[0].id),
    username: String(rows[0].username),
    displayName: rows[0].display_name ? String(rows[0].display_name) : String(rows[0].username),
    role,
    roles: [role],
    effectivePermissions: permissionsForRole(role),
    status: String(rows[0].status),
    lastLoginAt: rows[0].last_login_at ? String(rows[0].last_login_at) : null,
    createdAt: String(rows[0].created_at),
    updatedAt: String(rows[0].updated_at),
    activeSessions: sessions.items.filter((s) => s.status === "ACTIVE"),
    secrets: {
      password: false,
      passwordHash: false,
      jwt: false,
      otp: false,
    },
  };
}

/**
 * R1-M7 Admin console — HTTP API router.
 *
 * Single entrypoint `handleAdminApi(db, request, slug)` dispatched from the
 * catch-all route app/api/admin/[...slug]/route.ts. Every endpoint except
 * `login` requires a valid admin session; every endpoint enforces the RBAC
 * permission map; every mutating (dangerous) operation requires a `reason`
 * and writes an admin_audit_logs row with time / admin / IP / reason.
 *
 * Money-safety invariants enforced here:
 *   - no endpoint can modify wallet, ledger, math versions or balances via raw UPDATE;
 *   - deposit confirm / withdraw hold-release call MoneyService adapters only;
 *   - math versions remain read-only;
 *   - player freeze remains the only direct players.status mutation.
 */

import { sql } from "drizzle-orm";
import { ensureAdminBootstrap } from "./admin-bootstrap.ts";
import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  ADMIN_SESSION_TTL_MS,
  extractClientIp,
  generateAdminToken,
  hashAdminPassword,
  generateSalt,
  canGrantRole,
  extractAdminToken,
  isAdminRole,
  permissionModules,
  permissionsForRole,
  resolveAdminIdentity,
  ROLE_PERMISSIONS,
  roleHasPermission,
  type AdminIdentity,
  type AdminPermission,
  type AdminRole,
} from "./admin-auth.ts";
import {
  getAdminAuditFor,
  getAdminStats,
  getDashboardMetrics,
  getGameHealth,
  getGameOps,
  getLedgerHealth,
  getMathVersionDetail,
  getOpsReport,
  getPlayerDetail,
  getRiskSignals,
  getRoundDetail,
  getSessionDetail,
  getSystemConfig,
  getSystemMonitor,
  getAdminWalletDetail,
  getLedgerTransactionDetail,
  getWalletIntentDetail,
  listAdminAuditLogs,
  listAdmins,
  listAnnouncements,
  listGameAnomalies,
  listGameAuditEvents,
  listGames,
  listLedgerAccounts,
  listLedgerBalances,
  listLedgerEntries,
  listLedgerTransactions,
  listMathVersions,
  listMoneyIntegrityExceptions,
  listPlayers,
  listRounds,
  listSessions,
  listWalletBalances,
  listWalletIntents,
  listWalletProviderOps,
  normalizePage,
  type AdminDb,
} from "./admin-queries.ts";
import {
  getPlayerVip,
  listVipLevelConfig,
  setPlayerVip,
  upsertVipLevelConfig,
  type VipStatus,
} from "../vip-service.ts";
import {
  confirmDepositOrder,
  getDepositConfig,
  listAdminDeposits,
  listPaymentChannels,
  upsertDepositConfig,
} from "../deposit-service.ts";
import {
  getWithdrawalConfig,
  listAdminWithdrawals,
  markWithdrawalPaid,
  reviewWithdrawal,
  upsertWithdrawalConfig,
} from "../withdrawal-service.ts";
import {
  listAdminActivities,
  upsertActivity,
} from "../activity-service.ts";
import { isDevTestIdentityEnabled } from "../runtime-identity.ts";
import {
  addRiskNote,
  getRiskEventDetail,
  getRiskOverview,
  getRiskPlayerView,
  listRiskEvents,
  updateRiskEventStatus,
  type RiskStatus,
} from "./admin-risk.ts";
import { maskIp, presentIp } from "./admin-pii.ts";
import {
  assertLocalesComplete,
  normalizeLocaleBundle,
  parseAnnouncementLocales,
  toLegacyLocaleKeys,
} from "./admin-content-i18n.ts";
import {
  contentCenterMeta,
  getBanner,
  listBanners,
  listRecommendedGames,
  publishBanner,
  unpublishBanner,
  upsertBanner,
  upsertRecommendedGame,
} from "./admin-content.ts";
import {
  addTicketReply,
  createTicket,
  getTicket,
  listTickets,
  TICKET_META,
  updateTicket,
} from "./admin-tickets.ts";
import {
  countActiveSuperAdmins,
  getAdminSecurityOverview,
  getAdminUserDetail,
  listAdminSessions,
  listRoleCatalog,
  revokeAdminSessionByFingerprint,
  revokeOtherSessionsForAdmin,
} from "./admin-security.ts";

export const ADMIN_API_VERSION = "r1-m9-admin-1.0.0";
export const ADMIN_BASELINE_SHA = "9654d4194d2db801467af34cef1ddc5650fd310f";

/** Permissions flagged as dangerous in the admins permission matrix. */
const DANGEROUS_PERMISSIONS: AdminPermission[] = [
  "players:freeze",
  "players:session:revoke",
  "players:pii:view",
  "risk:manage",
  "risk:pii:view",
  "system:manage",
  "content:edit",
  "content:publish",
  "admins:manage",
  "admins:sessions:revoke",
  "support:manage",
  "deposit:manage",
  "withdraw:review",
  "withdraw:pay",
  "activity:manage",
];

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function err(code: string, message: string, status = 400): Response {
  return Response.json({ error: { code, message } }, { status });
}

type AuthedContext = {
  db: AdminDb;
  request: Request;
  admin: AdminIdentity;
  ip: string;
  requestId: string;
};

type AuditExtras = {
  before?: unknown;
  after?: unknown;
  detail?: unknown;
};

async function writeAuditLog(
  ctx: AuthedContext,
  action: string,
  targetType: string | null,
  targetId: string | null,
  reason: string,
  extras?: unknown | AuditExtras,
): Promise<void> {
  const packed = extras && typeof extras === "object" && !Array.isArray(extras)
    ? extras as AuditExtras & Record<string, unknown>
    : { detail: extras };
  const before = "before" in packed ? packed.before : undefined;
  const after = "after" in packed ? packed.after : undefined;
  const detail = "detail" in packed ? packed.detail : packed;
  const detailPayload = {
    ...(detail && typeof detail === "object" ? detail as object : { detail }),
    operator: ctx.admin.username,
    role: ctx.admin.role,
    requestId: ctx.requestId,
    before: before ?? null,
    after: after ?? null,
  };
  await ctx.db.run(sql`
    INSERT INTO admin_audit_logs
      ("id", "admin_id", "admin_username", "admin_role", "action", "target_type", "target_id",
       "reason", "ip", "request_id", "before_json", "after_json", "detail_json")
    VALUES
      (${crypto.randomUUID()}, ${ctx.admin.adminId}, ${ctx.admin.username}, ${ctx.admin.role}, ${action},
       ${targetType}, ${targetId}, ${reason}, ${ctx.ip}, ${ctx.requestId},
       ${before == null ? null : JSON.stringify(before)},
       ${after == null ? null : JSON.stringify(after)},
       ${JSON.stringify(detailPayload)})
  `);
}

function piiOptionsFor(admin: AdminIdentity) {
  return {
    viewPii: roleHasPermission(admin.role, "players:pii:view"),
    viewDevices: roleHasPermission(admin.role, "players:devices:view")
      || roleHasPermission(admin.role, "players:pii:view"),
    viewSessions: roleHasPermission(admin.role, "players:sessions:view")
      || roleHasPermission(admin.role, "players:pii:view"),
  };
}

function requireReason(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const reason = (payload as Record<string, unknown>).reason;
  if (typeof reason !== "string" || reason.trim().length < 2) return null;
  return reason.trim();
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

async function handleLogin(db: AdminDb, request: Request): Promise<Response> {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const username = typeof payload?.username === "string" ? payload.username.trim() : "";
  const password = typeof payload?.password === "string" ? payload.password : "";
  if (!username || !password) {
    return err("INVALID_REQUEST", "username and password are required");
  }

  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT id, username, password_hash, salt, role, status
    FROM admin_users WHERE username = ${username} LIMIT 1
  `);
  const admin = rows[0];
  if (!admin) {
    return err("LOGIN_FAILED", "Invalid username or password", 401);
  }
  const candidate = await hashAdminPassword(password, String(admin.salt));
  if (candidate !== String(admin.password_hash)) {
    return err("LOGIN_FAILED", "Invalid username or password", 401);
  }
  if (String(admin.status) !== "ACTIVE") {
    return err("ACCOUNT_DISABLED", "This account has been disabled", 403);
  }

  const token = generateAdminToken();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  const ip = extractClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "";
  await db.run(sql`
    INSERT INTO admin_sessions ("token", "admin_id", "ip", "user_agent", "expires_at")
    VALUES (${token}, ${String(admin.id)}, ${ip}, ${userAgent}, ${expiresAt})
  `);
  await db.run(sql`
    UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${String(admin.id)}
  `);

  const role = String(admin.role);
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const auditCtx: AuthedContext = {
    db,
    request,
    ip,
    requestId,
    admin: { adminId: String(admin.id), username: String(admin.username), role: role as AdminIdentity["role"] },
  };
  await writeAuditLog(auditCtx, "admin.login", "admin", String(admin.id), "login", {
    after: { event: "login", ip },
  });

  const response = json({
    token,
    admin: {
      id: String(admin.id),
      username: String(admin.username),
      role,
      permissions: ROLE_PERMISSIONS[role as AdminIdentity["role"]] === "*"
        ? [...ADMIN_PERMISSIONS]
        : [...(ROLE_PERMISSIONS[role as AdminIdentity["role"]] as readonly AdminPermission[])],
    },
    expiresAt,
  });
  response.headers.append(
    "set-cookie",
    `ab_admin=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(ADMIN_SESSION_TTL_MS / 1000)}`,
  );
  return response;
}

async function handleLogout(ctx: AuthedContext): Promise<Response> {
  const token = ctx.request.headers.get("authorization")?.slice(7).trim()
    ?? ctx.request.headers.get("cookie")?.match(/ab_admin=([^;]+)/)?.[1]
    ?? null;
  if (token) {
    await ctx.db.run(sql`DELETE FROM admin_sessions WHERE token = ${token}`);
  }
  await writeAuditLog(ctx, "admin.logout", "admin", ctx.admin.adminId, "logout");
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Mutations (dangerous operations — reason required, audited)
// ---------------------------------------------------------------------------

async function handlePlayerFreeze(ctx: AuthedContext, playerId: string, freeze: boolean): Promise<Response> {
  const payload = (await ctx.request.json().catch(() => null)) as unknown;
  const reason = requireReason(payload);
  if (!reason) {
    return err("REASON_REQUIRED", "A reason is required for this operation");
  }
  const target = freeze ? "LOCKED" : "ACTIVE";
  const guard = freeze ? "ACTIVE" : "LOCKED";
  const result = await ctx.db.run(sql`
    UPDATE players SET status = ${target}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${playerId} AND status = ${guard}
  `);
  const runResult = result as unknown as {
    rowsAffected?: number;
    changes?: number;
    meta?: { changes?: number };
  };
  const changed = Number(runResult.rowsAffected ?? runResult.changes ?? runResult.meta?.changes ?? 0);
  if (changed === 0) {
    return err("INVALID_STATE", freeze ? "Player is not ACTIVE" : "Player is not LOCKED", 409);
  }
  await writeAuditLog(
    ctx,
    freeze ? "player.freeze" : "player.unfreeze",
    "player",
    playerId,
    reason,
    { before: { status: guard }, after: { status: target } },
  );
  return json({ ok: true, playerId, status: target, requestId: ctx.requestId });
}

const ANNOUNCEMENT_TYPES = new Set(["SYSTEM", "ACTIVITY", "MAINTENANCE", "NOTICE"]);

async function handleAnnouncementCreate(ctx: AuthedContext): Promise<Response> {
  const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
  const reason = requireReason(payload);
  if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  if (!title) return err("INVALID_REQUEST", "title is required");

  const level = typeof payload?.level === "string" && ["INFO", "WARNING", "CRITICAL"].includes(payload.level)
    ? payload.level
    : "INFO";
  const statusRaw = typeof payload?.status === "string" ? payload.status.trim().toUpperCase() : "UNPUBLISHED";
  const status = statusRaw === "PUBLISHED" ? "PUBLISHED" : "UNPUBLISHED";
  const typeRaw = typeof payload?.type === "string" ? payload.type.trim().toUpperCase() : "NOTICE";
  const announcementType = ANNOUNCEMENT_TYPES.has(typeRaw) ? typeRaw : "NOTICE";

  const localesRaw = payload?.locales && typeof payload.locales === "object"
    ? payload.locales
    : null;
  const publishAt = typeof payload?.publishAt === "string" ? payload.publishAt.trim() : "";
  const expiresAt = typeof payload?.expiresAt === "string" ? payload.expiresAt.trim() : "";
  let content = typeof payload?.content === "string" ? payload.content.trim() : "";

  if (localesRaw) {
    const locales = normalizeLocaleBundle(localesRaw);
    if (status === "PUBLISHED") {
      const check = assertLocalesComplete(locales);
      if (!check.ok) return err(check.code, check.message);
    }
    content = JSON.stringify({
      zh: locales.zh,
      en: locales.en,
      my: locales.my,
      type: announcementType,
      ...(publishAt ? { publishAt } : {}),
      ...(expiresAt ? { expiresAt } : {}),
    });
  } else if (!content) {
    return err("INVALID_REQUEST", "content or locales is required");
  } else {
    if (status === "PUBLISHED") {
      const check = assertLocalesComplete(parseAnnouncementLocales(content));
      if (!check.ok) return err(check.code, check.message);
    }
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        content = JSON.stringify({
          ...parsed,
          type: announcementType,
          ...(publishAt ? { publishAt } : {}),
          ...(expiresAt ? { expiresAt } : {}),
        });
      }
    } catch {
      if (publishAt || expiresAt) {
        /* plain string — wrap */
        content = JSON.stringify({
          zh: content,
          en: content,
          my: content,
          type: announcementType,
          ...(publishAt ? { publishAt } : {}),
          ...(expiresAt ? { expiresAt } : {}),
        });
      }
    }
  }

  const id = crypto.randomUUID();
  const publishedAt = status === "PUBLISHED" ? new Date().toISOString() : null;
  const publishedBy = status === "PUBLISHED" ? ctx.admin.username : null;
  await ctx.db.run(sql`
    INSERT INTO admin_announcements
      ("id", "title", "content", "level", "status", "created_by",
       "announcement_type", "published_by", "published_at", "version")
    VALUES (
      ${id}, ${title}, ${content}, ${level}, ${status}, ${ctx.admin.username},
      ${announcementType}, ${publishedBy}, ${publishedAt}, 1
    )
  `);
  await writeAuditLog(ctx, "announcement.create", "announcement", id, reason, {
    before: null,
    after: { title, level, status, type: announcementType },
  });
  return json({ ok: true, id, status, type: announcementType }, 201);
}

async function handlePlayerLoginRestrict(
  ctx: AuthedContext,
  playerId: string,
  close: boolean,
): Promise<Response> {
  const payload = (await ctx.request.json().catch(() => null)) as unknown;
  const reason = requireReason(payload);
  if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
  const target = close ? "CLOSED" : "ACTIVE";
  const guard = close ? "ACTIVE" : "CLOSED";
  const result = await ctx.db.run(sql`
    UPDATE players SET status = ${target}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${playerId} AND status = ${guard}
  `);
  const runResult = result as unknown as {
    rowsAffected?: number;
    changes?: number;
    meta?: { changes?: number };
  };
  const changed = Number(runResult.rowsAffected ?? runResult.changes ?? runResult.meta?.changes ?? 0);
  if (changed === 0) {
    return err("INVALID_STATE", close ? "Player is not ACTIVE" : "Player is not CLOSED", 409);
  }
  await writeAuditLog(
    ctx,
    close ? "player.close" : "player.reopen",
    "player",
    playerId,
    reason,
    {
      before: { status: guard },
      after: { status: target },
      detail: {
        note: "CURRENT MODEL LIMITATION: CLOSED maps to 封禁 in Admin UI; no separate BAN enum.",
      },
    },
  );
  return json({ ok: true, playerId, status: target, requestId: ctx.requestId });
}

async function handleSessionRevoke(ctx: AuthedContext, sessionId: string): Promise<Response> {
  const payload = (await ctx.request.json().catch(() => null)) as unknown;
  const reason = requireReason(payload);
  if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
  const existing = await ctx.db.all<{ id: string; status: string }>(sql`
    SELECT id, status FROM game_sessions WHERE id = ${sessionId} LIMIT 1
  `);
  if (!existing[0]) return err("NOT_FOUND", "session not found", 404);
  if (String(existing[0].status) === "REVOKED") {
    return err("INVALID_STATE", "Session is already REVOKED", 409);
  }
  const result = await ctx.db.run(sql`
    UPDATE game_sessions SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP
    WHERE id = ${sessionId}
  `);
  const runResult = result as unknown as {
    rowsAffected?: number;
    changes?: number;
    meta?: { changes?: number };
  };
  const changed = Number(runResult.rowsAffected ?? runResult.changes ?? runResult.meta?.changes ?? 0);
  if (changed === 0) return err("NOT_FOUND", "session not found", 404);
  await writeAuditLog(ctx, "session.revoke", "game_session", sessionId, reason, {
    before: { status: String(existing[0].status) },
    after: { status: "REVOKED" },
  });
  return json({ ok: true, sessionId, status: "REVOKED", requestId: ctx.requestId });
}

async function handleAnnouncementStatus(ctx: AuthedContext, id: string, publish: boolean): Promise<Response> {
  const payload = (await ctx.request.json().catch(() => null)) as unknown;
  const reason = requireReason(payload);
  if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");

  const rows = await ctx.db.all<{
    id: string;
    status: string;
    content: string;
    title: string;
    version: number | null;
  }>(sql`
    SELECT id, status, content, title, version FROM admin_announcements WHERE id = ${id} LIMIT 1
  `);
  if (!rows[0]) return err("NOT_FOUND", "announcement not found", 404);
  const before = {
    status: String(rows[0].status),
    title: String(rows[0].title),
    version: Number(rows[0].version ?? 1),
  };

  // S-18: backend re-validates zh/en/my even if client bypasses UI.
  if (publish) {
    const locales = parseAnnouncementLocales(String(rows[0].content ?? ""));
    const check = assertLocalesComplete(locales);
    if (!check.ok) return err(check.code, check.message);
  }

  const status = publish ? "PUBLISHED" : "UNPUBLISHED";
  const publishedAt = publish ? new Date().toISOString() : null;
  const publishedBy = publish ? ctx.admin.username : null;
  const nextVersion = Number(rows[0].version ?? 1) + 1;
  await ctx.db.run(sql`
    UPDATE admin_announcements SET
      status = ${status},
      published_by = COALESCE(${publishedBy}, published_by),
      published_at = COALESCE(${publishedAt}, published_at),
      version = ${nextVersion},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `);
  await writeAuditLog(
    ctx,
    publish ? "announcement.publish" : "announcement.unpublish",
    "announcement",
    id,
    reason,
    {
      before,
      after: { status, publishedBy, publishedAt, version: nextVersion },
    },
  );
  return json({ ok: true, id, status, version: nextVersion, s18: "CLOSED" });
}

const EDITABLE_CONFIG_KEYS = new Set(["maintenance_mode", "support_info", "languages"]);

async function handleSystemConfigUpdate(ctx: AuthedContext): Promise<Response> {
  const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
  const reason = requireReason(payload);
  if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
  const key = typeof payload?.key === "string" ? payload.key : "";
  if (!EDITABLE_CONFIG_KEYS.has(key)) {
    return err("INVALID_REQUEST", `config key must be one of: ${[...EDITABLE_CONFIG_KEYS].join(", ")}`);
  }
  if (payload?.value === undefined) return err("INVALID_REQUEST", "value is required");
  if (key === "maintenance_mode" && typeof (payload.value as Record<string, unknown>)?.enabled !== "boolean") {
    return err("INVALID_REQUEST", "maintenance_mode.value.enabled must be boolean");
  }
  await ctx.db.run(sql`
    INSERT INTO admin_system_config ("key", "value_json", "updated_by", "updated_at")
    VALUES (${key}, ${JSON.stringify(payload.value)}, ${ctx.admin.username}, CURRENT_TIMESTAMP)
    ON CONFLICT("key") DO UPDATE SET
      value_json = excluded.value_json,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `);
  await writeAuditLog(ctx, "system.config.update", "system_config", key, reason, { value: payload.value });
  return json({ ok: true, key });
}

async function handleAdminCreate(ctx: AuthedContext): Promise<Response> {
  const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
  const reason = requireReason(payload);
  if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
  const username = typeof payload?.username === "string" ? payload.username.trim() : "";
  const password = typeof payload?.password === "string" ? payload.password : "";
  const role = payload?.role;
  const displayName = typeof payload?.displayName === "string" ? payload.displayName.trim() : "";
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    return err("INVALID_REQUEST", "username must be 3-32 chars [a-zA-Z0-9_.-]");
  }
  if (password.length < 8) return err("INVALID_REQUEST", "password must be at least 8 chars");
  if (!isAdminRole(role)) return err("INVALID_REQUEST", "invalid role");
  if (!canGrantRole(ctx.admin.role, role)) {
    return err("PRIVILEGE_ESCALATION", "Cannot grant a role beyond your privilege", 403);
  }
  // Least privilege: never default-create SUPER_ADMIN unless explicit SUPER actor.
  if (role === "SUPER_ADMIN" && ctx.admin.role !== "SUPER_ADMIN") {
    return err("PRIVILEGE_ESCALATION", "Only SUPER_ADMIN may create SUPER_ADMIN", 403);
  }

  const existing = await ctx.db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM admin_users WHERE username = ${username}
  `);
  if (Number(existing[0]?.n ?? 0) > 0) return err("DUPLICATE", "username already exists", 409);

  const salt = generateSalt();
  const passwordHash = await hashAdminPassword(password, salt);
  const id = crypto.randomUUID();
  await ctx.db.run(sql`
    INSERT INTO admin_users ("id", "username", "password_hash", "salt", "role", "status", "display_name")
    VALUES (${id}, ${username}, ${passwordHash}, ${salt}, ${role}, 'ACTIVE', ${displayName || null})
  `);
  await writeAuditLog(ctx, "admin.create", "admin", id, reason, {
    before: null,
    after: { username, role, displayName: displayName || null },
  });
  return json({ ok: true, id, role }, 201);
}

async function handleAdminUpdate(ctx: AuthedContext, targetId: string): Promise<Response> {
  const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
  const reason = requireReason(payload);
  if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
  const action = typeof payload?.action === "string" ? payload.action : "";

  if (targetId === ctx.admin.adminId && (action === "disable" || action === "change_role")) {
    return err("SELF_OPERATION", "You cannot perform this action on yourself", 409);
  }

  const rows = await ctx.db.all<Record<string, unknown>>(sql`
    SELECT id, username, status, role FROM admin_users WHERE id = ${targetId} LIMIT 1
  `);
  const target = rows[0];
  if (!target) return err("NOT_FOUND", "admin not found", 404);
  const beforeRole = String(target.role);
  const beforeStatus = String(target.status);

  switch (action) {
    case "disable":
    case "enable": {
      if (action === "disable" && beforeRole === "SUPER_ADMIN" && beforeStatus === "ACTIVE") {
        const supers = await countActiveSuperAdmins(ctx.db);
        if (supers <= 1) {
          return err(
            "LAST_SUPER_ADMIN",
            "Cannot disable the last ACTIVE SUPER_ADMIN",
            409,
          );
        }
      }
      const status = action === "disable" ? "DISABLED" : "ACTIVE";
      await ctx.db.run(sql`
        UPDATE admin_users SET status = ${status}, updated_at = CURRENT_TIMESTAMP WHERE id = ${targetId}
      `);
      if (action === "disable") {
        await ctx.db.run(sql`DELETE FROM admin_sessions WHERE admin_id = ${targetId}`);
      }
      await writeAuditLog(ctx, `admin.${action}`, "admin", targetId, reason, {
        before: { status: beforeStatus, role: beforeRole },
        after: { status, role: beforeRole },
      });
      return json({ ok: true, id: targetId, status, sessionsRevoked: action === "disable" });
    }
    case "change_role": {
      const role = payload?.role;
      if (!isAdminRole(role)) return err("INVALID_REQUEST", "invalid role");
      if (!canGrantRole(ctx.admin.role, role)) {
        return err("PRIVILEGE_ESCALATION", "Cannot assign a role beyond your privilege", 403);
      }
      if (
        beforeRole === "SUPER_ADMIN"
        && role !== "SUPER_ADMIN"
        && beforeStatus === "ACTIVE"
      ) {
        const supers = await countActiveSuperAdmins(ctx.db);
        if (supers <= 1) {
          return err(
            "LAST_SUPER_ADMIN",
            "Cannot demote the last ACTIVE SUPER_ADMIN",
            409,
          );
        }
      }
      await ctx.db.run(sql`
        UPDATE admin_users SET role = ${role}, updated_at = CURRENT_TIMESTAMP WHERE id = ${targetId}
      `);
      // Role change must invalidate sessions so UI/token cannot keep stale privilege assumption.
      await ctx.db.run(sql`DELETE FROM admin_sessions WHERE admin_id = ${targetId}`);
      await writeAuditLog(ctx, "admin.change_role", "admin", targetId, reason, {
        before: { role: beforeRole },
        after: { role },
      });
      return json({ ok: true, id: targetId, role, sessionsRevoked: true });
    }
    case "reset_password": {
      const password = typeof payload?.password === "string" ? payload.password : "";
      if (password.length < 8) return err("INVALID_REQUEST", "password must be at least 8 chars");
      const salt = generateSalt();
      const passwordHash = await hashAdminPassword(password, salt);
      await ctx.db.run(sql`
        UPDATE admin_users SET password_hash = ${passwordHash}, salt = ${salt}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${targetId}
      `);
      await ctx.db.run(sql`DELETE FROM admin_sessions WHERE admin_id = ${targetId}`);
      await writeAuditLog(ctx, "admin.reset_password", "admin", targetId, reason, {
        before: { passwordReset: false },
        after: { passwordReset: true, sessionsRevoked: true },
      });
      return json({ ok: true, id: targetId, sessionsRevoked: true });
    }
    default:
      return err("INVALID_REQUEST", "action must be disable|enable|change_role|reset_password");
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

type RouteSpec = {
  method: string;
  segments: string[];
  permission: AdminPermission | null; // null = unauthenticated (login)
  handler: (ctx: AuthedContext, parts: string[]) => Promise<Response>;
};

function defineRoutes(): RouteSpec[] {
  const routes: RouteSpec[] = [];
  const get = (path: string, permission: AdminPermission, handler: RouteSpec["handler"]) =>
    routes.push({ method: "GET", segments: path.split("/"), permission, handler });
  const post = (path: string, permission: AdminPermission | null, handler: RouteSpec["handler"]) =>
    routes.push({ method: "POST", segments: path.split("/"), permission, handler });

  post("login", null, async () => {
    // handled before auth; placeholder never invoked
    throw new Error("unreachable");
  });
  post("logout", "dashboard:view", (ctx) => handleLogout(ctx));

  get("me", "dashboard:view", async (ctx) =>
    json({
      admin: {
        id: ctx.admin.adminId,
        username: ctx.admin.username,
        role: ctx.admin.role,
        permissions: ROLE_PERMISSIONS[ctx.admin.role] === "*"
          ? [...ADMIN_PERMISSIONS]
          : [...(ROLE_PERMISSIONS[ctx.admin.role] as readonly AdminPermission[])],
      },
    }));
  get("dashboard", "dashboard:view", async (ctx) => json(await getDashboardMetrics(ctx.db)));

  get("players", "players:view", async (ctx) =>
    json(await listPlayers(ctx.db, normalizePage(new URL(ctx.request.url).searchParams), {
      pii: piiOptionsFor(ctx.admin),
    })));
  get("players/:id", "players:view", async (ctx, parts) => {
    const detail = await getPlayerDetail(ctx.db, decodeURIComponent(parts[1]), {
      pii: piiOptionsFor(ctx.admin),
    });
    if (!detail) return err("NOT_FOUND", "player not found", 404);
    return json(detail);
  });
  post("players/:id/freeze", "players:freeze", (ctx, parts) =>
    handlePlayerFreeze(ctx, decodeURIComponent(parts[1]), true));
  post("players/:id/unfreeze", "players:freeze", (ctx, parts) =>
    handlePlayerFreeze(ctx, decodeURIComponent(parts[1]), false));
  post("players/:id/close", "players:freeze", (ctx, parts) =>
    handlePlayerLoginRestrict(ctx, decodeURIComponent(parts[1]), true));
  post("players/:id/reopen", "players:freeze", (ctx, parts) =>
    handlePlayerLoginRestrict(ctx, decodeURIComponent(parts[1]), false));

  get("vip/levels", "vip:view", async (ctx) =>
    json({ items: await listVipLevelConfig(ctx.db) }));
  post("vip/levels", "vip:manage", async (ctx) => {
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
    if (
      payload?.rtpBonus != null ||
      payload?.moneyMultiplier != null ||
      payload?.walletCredit != null ||
      (payload?.conditions && typeof payload.conditions === "object" && (
        "rtpBonus" in (payload.conditions as object) ||
        "moneyMultiplier" in (payload.conditions as object) ||
        "walletCredit" in (payload.conditions as object)
      ))
    ) {
      return err(
        "VIP_HIGH_RISK_BLOCKED",
        "RTP Bonus / Money Multiplier / Wallet Credit edits are blocked in ADMIN-1F",
      );
    }
    const level = Number(payload?.level);
    const code = typeof payload?.code === "string" ? payload.code.trim() : "";
    const titleBundle = normalizeLocaleBundle(payload?.title);
    const title = toLegacyLocaleKeys(titleBundle);
    const conditions = (payload?.conditions && typeof payload.conditions === "object"
      ? payload.conditions
      : {}) as Record<string, unknown>;
    const enabled = payload?.enabled !== false;
    if (!Number.isInteger(level) || level < 1 || level > 6 || !code) {
      return err("INVALID_REQUEST", "level 1–6 and code are required");
    }
    await upsertVipLevelConfig(ctx.db, { level, code, title, conditions, enabled });
    await writeAuditLog(ctx, "vip.level.upsert", "vip_level", String(level), reason, {
      before: null,
      after: { code, conditions, enabled, title: titleBundle },
    });
    return json({ ok: true, level });
  });
  get("vip/players/:id", "vip:view", async (ctx, parts) =>
    json({ vip: await getPlayerVip(ctx.db, decodeURIComponent(parts[2])) }));
  post("vip/players/:id", "vip:manage", async (ctx, parts) => {
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
    const playerId = decodeURIComponent(parts[2]);
    const level = Number(payload?.level);
    const status = String(payload?.status ?? "ACTIVE") as VipStatus;
    if (!Number.isInteger(level) || level < 0 || level > 6) {
      return err("INVALID_REQUEST", "level must be 0–6");
    }
    if (!["ACTIVE", "EXPIRED", "PENDING", "SUSPENDED"].includes(status)) {
      return err("INVALID_REQUEST", "invalid VIP status");
    }
    const vip = await setPlayerVip(ctx.db, playerId, {
      level,
      status,
      vipStartedAt: typeof payload?.vipStartedAt === "string" ? payload.vipStartedAt : undefined,
      vipExpiresAt: typeof payload?.vipExpiresAt === "string" ? payload.vipExpiresAt : undefined,
    });
    await writeAuditLog(ctx, "vip.player.set", "player", playerId, reason, { level, status });
    return json({ ok: true, vip });
  });

  get("sessions", "rounds:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    return json(await listSessions(ctx.db, {
      ...normalizePage(params),
      playerId: params.get("playerId") ?? undefined,
    }));
  });
  get("sessions/:id", "rounds:view", async (ctx, parts) => {
    const detail = await getSessionDetail(ctx.db, decodeURIComponent(parts[1]));
    if (!detail) return err("NOT_FOUND", "session not found", 404);
    return json(detail);
  });
  post("sessions/:id/revoke", "players:session:revoke", (ctx, parts) =>
    handleSessionRevoke(ctx, decodeURIComponent(parts[1])));

  // Games / Rounds / Spins / Health share existing `rounds:view` (colon RBAC).
  // Spec labels games.view / games.rounds.view / games.spins.view / games.health.view
  // map to this permission — do not create a parallel permission system.
  get("games", "rounds:view", async (ctx) => json(await listGames(ctx.db)));
  get("games/:id/ops", "rounds:view", async (ctx, parts) => {
    const ops = await getGameOps(ctx.db, decodeURIComponent(parts[1]));
    if (!ops) return err("NOT_FOUND", "game not found", 404);
    return json(ops);
  });
  get("games/:id/health", "rounds:view", async (ctx, parts) => {
    const health = await getGameHealth(ctx.db, decodeURIComponent(parts[1]));
    if (!health) return err("NOT_FOUND", "game not found", 404);
    return json(health);
  });
  get("games/:id/anomalies", "rounds:view", async (ctx, parts) => {
    const id = decodeURIComponent(parts[1]);
    if (id !== "bull-demon-king") return err("NOT_FOUND", "game not found", 404);
    const params = new URL(ctx.request.url).searchParams;
    const limit = Number(params.get("limit") ?? "50") || 50;
    return json(await listGameAnomalies(ctx.db, limit));
  });

  get("rounds", "rounds:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    const page = normalizePage(params);
    return json(await listRounds(ctx.db, {
      ...page,
      playerId: params.get("playerId") ?? undefined,
      sessionId: params.get("sessionId") ?? undefined,
      gameId: params.get("gameId") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      roundId: params.get("roundId") ?? undefined,
    }));
  });
  get("rounds/:id", "rounds:view", async (ctx, parts) => {
    const roundId = decodeURIComponent(parts[1]);
    const detail = await getRoundDetail(ctx.db, roundId);
    if (!detail) return err("NOT_FOUND", "round not found", 404);
    await writeAuditLog(ctx, "rounds.detail.view", "game_round", roundId, "view", {
      gameId: detail.gameId,
      ledgerReferences: detail.ledgerReferences,
    });
    return json(detail);
  });

  // Spin is the product-facing name for a settled/pending game_round (read-only alias).
  get("spins", "rounds:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    return json(await listRounds(ctx.db, {
      ...normalizePage(params),
      playerId: params.get("playerId") ?? undefined,
      sessionId: params.get("sessionId") ?? undefined,
      gameId: params.get("gameId") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      roundId: params.get("roundId") ?? undefined,
    }));
  });
  get("spins/:id", "rounds:view", async (ctx, parts) => {
    const spinId = decodeURIComponent(parts[1]);
    const detail = await getRoundDetail(ctx.db, spinId);
    if (!detail) return err("NOT_FOUND", "spin not found", 404);
    await writeAuditLog(ctx, "spins.detail.view", "game_round", spinId, "view", {
      gameId: detail.gameId,
      ledgerReferences: detail.ledgerReferences,
    });
    return json(detail);
  });

  get("reports/ops", "dashboard:view", async (ctx) => json(await getOpsReport(ctx.db)));

  get("wallet/balances", "wallet:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    return json(await listWalletBalances(ctx.db, {
      ...normalizePage(params),
      currency: params.get("currency") ?? undefined,
    }));
  });
  get("wallet/players/:id", "wallet:view", async (ctx, parts) => {
    const playerId = decodeURIComponent(parts[2]);
    const detail = await getAdminWalletDetail(ctx.db, playerId);
    if (!detail) return err("NOT_FOUND", "player wallet not found", 404);
    await writeAuditLog(ctx, "wallet.detail.view", "player_wallet", playerId, "view", {
      currency: detail.currency,
      frozenMinor: detail.frozenMinor,
    });
    return json(detail);
  });
  get("wallet/integrity", "wallet:integrity:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    const limit = Math.min(200, Math.max(1, Number(params.get("limit") ?? "100") || 100));
    const result = await listMoneyIntegrityExceptions(ctx.db, limit);
    await writeAuditLog(ctx, "wallet.integrity.view", "money_integrity", "scan", "view", {
      count: result.items.length,
    });
    return json(result);
  });
  get("money/gate", "dashboard:view", async () =>
    json({
      productionMoney: false,
      providerConfigured: false,
      realMoneyProvider: "NOT_CONFIGURED",
      gate: "CLOSED",
      testHarnessEnabled: isDevTestIdentityEnabled(),
      csvExport: "FUTURE",
      walletAdjust: "BLOCKED",
    }));
  get("wallet/intents", "wallet:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    return json(await listWalletIntents(ctx.db, {
      ...normalizePage(params),
      operation: params.get("operation") ?? undefined,
    }));
  });
  get("wallet/intents/:id", "wallet:view", async (ctx, parts) => {
    const detail = await getWalletIntentDetail(ctx.db, decodeURIComponent(parts[2]));
    if (!detail) return err("NOT_FOUND", "wallet intent not found", 404);
    return json(detail);
  });
  get("wallet/provider-ops", "wallet:view", async (ctx) =>
    json(await listWalletProviderOps(ctx.db, normalizePage(new URL(ctx.request.url).searchParams))));

  get("deposits", "deposit:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    const page = normalizePage(params);
    return json(await listAdminDeposits(ctx.db, {
      playerId: params.get("playerId") ?? undefined,
      status: params.get("status") ?? undefined,
      limit: page.pageSize,
      offset: (page.page - 1) * page.pageSize,
    }));
  });
  get("deposits/config", "deposit:view", async (ctx) =>
    json({
      config: await getDepositConfig(ctx.db),
      channels: await listPaymentChannels(ctx.db),
    }));
  post("deposits/config", "deposit:manage", async (ctx) => {
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
    const config = await upsertDepositConfig(ctx.db, (payload?.config ?? {}) as Record<string, unknown>);
    await writeAuditLog(ctx, "deposit.config.upsert", "wallet_commerce_config", "deposit", reason, config);
    return json({ ok: true, config });
  });
  post("deposits/:id/confirm", "deposit:manage", async (ctx, parts) => {
    if (!isDevTestIdentityEnabled()) {
      return err(
        "PROVIDER_NOT_CONFIGURED",
        "Live provider confirm blocked (BR-007); enable test identity for harness",
        503,
      );
    }
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
    const id = decodeURIComponent(parts[1]);
    const result = await confirmDepositOrder(ctx.db, { orderId: id });
    if (!result.ok) return err(result.code, result.message, result.code === "NOT_FOUND" ? 404 : 400);
    await writeAuditLog(ctx, "deposit.confirm", "deposit_order", id, reason, {
      status: result.order.status,
      alreadyCredited: result.alreadyCredited ?? false,
    });
    return json({ ok: true, order: result.order, balanceAfterMinor: result.balanceAfterMinor });
  });

  get("withdrawals", "withdraw:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    const page = normalizePage(params);
    return json(await listAdminWithdrawals(ctx.db, {
      playerId: params.get("playerId") ?? undefined,
      status: params.get("status") ?? undefined,
      limit: page.pageSize,
      offset: (page.page - 1) * page.pageSize,
    }));
  });
  get("withdrawals/config", "withdraw:view", async (ctx) =>
    json({ config: await getWithdrawalConfig(ctx.db) }));
  post("withdrawals/config", "withdraw:review", async (ctx) => {
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
    const config = await upsertWithdrawalConfig(
      ctx.db,
      (payload?.config ?? {}) as Record<string, unknown>,
    );
    await writeAuditLog(ctx, "withdraw.config.upsert", "wallet_commerce_config", "withdrawal", reason, config);
    return json({ ok: true, config });
  });
  post("withdrawals/:id/approve", "withdraw:review", async (ctx, parts) => {
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
    const id = decodeURIComponent(parts[1]);
    const result = await reviewWithdrawal(ctx.db, {
      id,
      action: "APPROVE",
      adminId: ctx.admin.adminId,
      reason,
    });
    if (!result.ok) return err(result.code, result.message, result.code === "NOT_FOUND" ? 404 : 400);
    await writeAuditLog(ctx, "withdraw.approve", "withdrawal_request", id, reason, {
      status: result.request.status,
    });
    return json({ ok: true, request: result.request });
  });
  post("withdrawals/:id/reject", "withdraw:review", async (ctx, parts) => {
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
    const id = decodeURIComponent(parts[1]);
    const result = await reviewWithdrawal(ctx.db, {
      id,
      action: "REJECT",
      adminId: ctx.admin.adminId,
      reason,
    });
    if (!result.ok) return err(result.code, result.message, result.code === "NOT_FOUND" ? 404 : 400);
    await writeAuditLog(ctx, "withdraw.reject", "withdrawal_request", id, reason, {
      status: result.request.status,
    });
    return json({ ok: true, request: result.request });
  });
  post("withdrawals/:id/pay", "withdraw:pay", async (ctx, parts) => {
    if (!isDevTestIdentityEnabled()) {
      return err(
        "PROVIDER_NOT_CONFIGURED",
        "Live provider payout blocked; PRODUCTION MONEY GATE CLOSED",
        503,
      );
    }
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
    const id = decodeURIComponent(parts[1]);
    const result = await markWithdrawalPaid(ctx.db, {
      id,
      adminId: ctx.admin.adminId,
      reason,
    });
    if (!result.ok) return err(result.code, result.message, result.code === "NOT_FOUND" ? 404 : 400);
    await writeAuditLog(ctx, "withdraw.pay", "withdrawal_request", id, reason, {
      status: result.request.status,
    });
    return json({ ok: true, request: result.request });
  });

  get("activities", "activity:view", async (ctx) =>
    json({
      items: await listAdminActivities(ctx.db),
      rewardPayout: "BLOCKED",
      note: "Admin cannot credit balances; player claim uses Reward/MoneyService under TEST gate only",
    }));
  post("activities", "activity:manage", async (ctx) => {
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
    if (payload?.creditPlayer === true || payload?.payout === true) {
      return err("REWARD_PAYOUT_BLOCKED", "Admin activity payout is blocked; PRODUCTION MONEY GATE CLOSED");
    }
    const code = typeof payload?.code === "string" ? payload.code.trim() : "";
    const kind = typeof payload?.kind === "string" ? payload.kind.trim() : "EVENT";
    const titleBundle = normalizeLocaleBundle(payload?.title);
    const bodyBundle = normalizeLocaleBundle(payload?.body);
    const title = toLegacyLocaleKeys(titleBundle);
    const body = toLegacyLocaleKeys(bodyBundle);
    const rewardMinor = Number(payload?.rewardMinor ?? 0);
    if (!code || !Number.isFinite(rewardMinor)) {
      return err("INVALID_REQUEST", "code and rewardMinor required");
    }
    if (payload?.enabled === true || payload?.publish === true) {
      const check = assertLocalesComplete(titleBundle);
      if (!check.ok) return err(check.code, check.message);
    }
    const saved = await upsertActivity(ctx.db, {
      id: typeof payload?.id === "string" ? payload.id : undefined,
      code,
      kind,
      title,
      body,
      rewardMinor,
      currency: typeof payload?.currency === "string" ? payload.currency : "MMK",
      startsAt: typeof payload?.startsAt === "string" ? payload.startsAt : null,
      endsAt: typeof payload?.endsAt === "string" ? payload.endsAt : null,
      enabled: payload?.enabled !== false,
    });
    await writeAuditLog(ctx, "activity.upsert", "player_activity", saved.id, reason, {
      before: null,
      after: { code, rewardMinor, enabled: payload?.enabled !== false, title: titleBundle },
    });
    return json({ ok: true, id: saved.id, rewardPayout: "BLOCKED" });
  });

  get("ledger/accounts", "ledger:view", async (ctx) =>
    json(await listLedgerAccounts(ctx.db, normalizePage(new URL(ctx.request.url).searchParams))));
  get("ledger/transactions", "ledger:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    const dateFrom = params.get("dateFrom")?.trim() || undefined;
    const dateTo = params.get("dateTo")?.trim() || undefined;
    if (dateFrom && dateTo) {
      const fromMs = Date.parse(dateFrom.includes("T") ? dateFrom : `${dateFrom}T00:00:00Z`);
      const toMs = Date.parse(dateTo.includes("T") ? dateTo : `${dateTo}T23:59:59Z`);
      if (Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs - fromMs > 93 * 86400000) {
        return err("RANGE_TOO_LARGE", "Ledger time range must be <= 93 days", 400);
      }
    }
    const directionRaw = params.get("direction")?.trim().toUpperCase();
    const direction =
      directionRaw === "DEBIT" || directionRaw === "CREDIT" ? directionRaw : undefined;
    return json(await listLedgerTransactions(ctx.db, {
      ...normalizePage(params),
      playerId: params.get("playerId") ?? undefined,
      currency: params.get("currency") ?? undefined,
      direction,
      roundId: params.get("roundId") ?? undefined,
      spinId: params.get("spinId") ?? undefined,
      referenceId: params.get("referenceId") ?? undefined,
      depositOrderId: params.get("depositOrderId") ?? undefined,
      withdrawalOrderId: params.get("withdrawalOrderId") ?? undefined,
      dateFrom,
      dateTo,
    }));
  });
  get("ledger/transactions/:id", "ledger:view", async (ctx, parts) => {
    const id = decodeURIComponent(parts[2]);
    const detail = await getLedgerTransactionDetail(ctx.db, id);
    if (!detail) return err("NOT_FOUND", "ledger transaction not found", 404);
    await writeAuditLog(ctx, "ledger.detail.view", "ledger_transaction", id, "view", {
      playerId: detail.playerId,
      roundId: detail.links.roundId,
    });
    return json(detail);
  });
  get("ledger/entries", "ledger:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    return json(await listLedgerEntries(ctx.db, {
      ...normalizePage(params),
      transactionId: params.get("transactionId") ?? undefined,
    }));
  });
  get("ledger/balances", "ledger:view", async (ctx) =>
    json(await listLedgerBalances(ctx.db, normalizePage(new URL(ctx.request.url).searchParams))));
  get("ledger/health", "ledger:view", async (ctx) => json(await getLedgerHealth(ctx.db)));

  get("math-versions", "math:view", async (ctx) => json({ items: await listMathVersions(ctx.db) }));
  get("math-versions/:id", "math:view", async (ctx, parts) => {
    const detail = await getMathVersionDetail(ctx.db, decodeURIComponent(parts[1]));
    if (!detail) return err("NOT_FOUND", "math version not found", 404);
    return json(detail);
  });

  get("risk/signals", "risk:view", async (ctx) => {
    const signals = await getRiskSignals(ctx.db);
    const params = new URL(ctx.request.url).searchParams;
    const level = params.get("level");
    const type = params.get("type");
    const filtered = signals.filter((signal) =>
      (!level || signal.level === level) && (!type || signal.type === type));
    const summary = {
      total: filtered.length,
      critical: filtered.filter((s) => s.level === "CRITICAL").length,
      high: filtered.filter((s) => s.level === "HIGH").length,
      medium: filtered.filter((s) => s.level === "MEDIUM").length,
      low: filtered.filter((s) => s.level === "LOW").length,
    };
    return json({ summary, items: filtered });
  });
  get("risk/overview", "risk:view", async (ctx) => json(await getRiskOverview(ctx.db)));
  get("risk/events", "risk:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    const dateFrom = params.get("dateFrom")?.trim() || undefined;
    const dateTo = params.get("dateTo")?.trim() || undefined;
    if (dateFrom && dateTo) {
      const fromMs = Date.parse(dateFrom.includes("T") ? dateFrom : `${dateFrom}T00:00:00Z`);
      const toMs = Date.parse(dateTo.includes("T") ? dateTo : `${dateTo}T23:59:59Z`);
      if (Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs - fromMs > 93 * 86400000) {
        return err("RANGE_TOO_LARGE", "Risk time range must be <= 93 days", 400);
      }
    }
    return json(await listRiskEvents(ctx.db, {
      ...normalizePage(params),
      playerId: params.get("playerId") ?? undefined,
      riskId: params.get("riskId") ?? undefined,
      type: params.get("type") ?? undefined,
      category: params.get("category") ?? undefined,
      level: params.get("level") ?? undefined,
      status: params.get("status") ?? undefined,
      dateFrom,
      dateTo,
    }));
  });
  get("risk/events/:id", "risk:view", async (ctx, parts) => {
    const id = decodeURIComponent(parts[2]);
    const detail = await getRiskEventDetail(ctx.db, id);
    if (!detail) return err("NOT_FOUND", "risk event not found", 404);
    await writeAuditLog(ctx, "risk.detail.view", "risk_event", id, "view", {
      playerId: detail.event.playerId,
      type: detail.event.type,
    });
    return json(detail);
  });
  get("risk/players/:id", "risk:view", async (ctx, parts) => {
    const playerId = decodeURIComponent(parts[2]);
    const view = await getRiskPlayerView(ctx.db, playerId);
    await writeAuditLog(ctx, "risk.player.view", "player", playerId, "view", {
      openEventCount: view.openEventCount,
      riskLevel: view.riskLevel,
    });
    return json(view);
  });
  post("risk/events/:id/status", "risk:manage", async (ctx, parts) => {
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for risk disposition");
    const statusRaw = typeof payload?.status === "string" ? payload.status.trim().toUpperCase() : "";
    if (!["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"].includes(statusRaw)) {
      return err("INVALID_REQUEST", "status must be OPEN|REVIEWING|RESOLVED|DISMISSED");
    }
    const id = decodeURIComponent(parts[2]);
    const before = await getRiskEventDetail(ctx.db, id);
    const result = await updateRiskEventStatus(ctx.db, {
      riskId: id,
      status: statusRaw as RiskStatus,
      reason,
      adminId: ctx.admin.adminId,
      adminUsername: ctx.admin.username,
    });
    if (!result.ok) {
      return err(result.code, result.message, result.code === "NOT_FOUND" ? 404 : 400);
    }
    await writeAuditLog(ctx, "risk.status.change", "risk_event", id, reason, {
      before: before?.event ?? null,
      after: result.event,
      autoFreeze: false,
      autoBalanceChange: false,
    });
    return json({ ok: true, event: result.event, autoActions: { freeze: false, balance: false } });
  });
  post("risk/events/:id/notes", "risk:manage", async (ctx, parts) => {
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const note = typeof payload?.note === "string" ? payload.note.trim() : "";
    if (note.length < 2) return err("INVALID_REQUEST", "note required");
    const id = decodeURIComponent(parts[2]);
    const result = await addRiskNote(ctx.db, {
      riskId: id,
      note,
      adminId: ctx.admin.adminId,
      adminUsername: ctx.admin.username,
    });
    if (!result.ok) return err(result.code, result.message, 404);
    await writeAuditLog(ctx, "risk.note.add", "risk_event", id, "note", {
      noteId: result.id,
      // notes are append-only; never overwrite history
    });
    return json({ ok: true, id: result.id });
  });

  get("system/config", "system:view", async (ctx) => json({ items: await getSystemConfig(ctx.db) }));
  post("system/config", "system:manage", (ctx) => handleSystemConfigUpdate(ctx));
  // Announcements — content:* RBAC (S-18 publish re-check in handler). system:* kept as alias paths.
  get("system/announcements", "content:view", async (ctx) => json({ items: await listAnnouncements(ctx.db) }));
  post("system/announcements", "content:edit", (ctx) => handleAnnouncementCreate(ctx));
  post("system/announcements/:id/publish", "content:publish", (ctx, parts) =>
    handleAnnouncementStatus(ctx, decodeURIComponent(parts[2]), true));
  post("system/announcements/:id/unpublish", "content:publish", (ctx, parts) =>
    handleAnnouncementStatus(ctx, decodeURIComponent(parts[2]), false));

  get("content/meta", "content:view", async () => json(contentCenterMeta()));
  get("content/banners", "content:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    return json(await listBanners(ctx.db, {
      page: Number(params.get("page") ?? "1") || 1,
      pageSize: Number(params.get("pageSize") ?? "20") || 20,
      status: params.get("status") ?? undefined,
    }));
  });
  get("content/banners/:id", "content:view", async (ctx, parts) => {
    const banner = await getBanner(ctx.db, decodeURIComponent(parts[2]));
    if (!banner) return err("NOT_FOUND", "banner not found", 404);
    return json({ banner });
  });
  post("content/banners", "content:edit", async (ctx) => {
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
    const result = await upsertBanner(ctx.db, {
      id: typeof payload?.id === "string" ? payload.id : undefined,
      title: typeof payload?.title === "string" ? payload.title : "",
      locales: payload?.locales,
      imageUrl: typeof payload?.imageUrl === "string" ? payload.imageUrl : "",
      targetUrl: typeof payload?.targetUrl === "string" ? payload.targetUrl : null,
      startsAt: typeof payload?.startsAt === "string" ? payload.startsAt : null,
      endsAt: typeof payload?.endsAt === "string" ? payload.endsAt : null,
      sortOrder: typeof payload?.sortOrder === "number" ? payload.sortOrder : undefined,
      textStrategy: payload?.textStrategy === "IMAGE_ONLY" ? "IMAGE_ONLY" : "TRI_LOCALE",
      status: payload?.status === "PAUSED" ? "PAUSED" : "DRAFT",
      adminUsername: ctx.admin.username,
    });
    if (!result.ok) return err(result.code, result.message, result.code === "NOT_FOUND" ? 404 : 400);
    await writeAuditLog(ctx, payload?.id ? "banner.edit" : "banner.create", "banner", result.banner.id, reason, {
      before: null,
      after: result.banner,
    });
    return json({ ok: true, banner: result.banner }, payload?.id ? 200 : 201);
  });
  post("content/banners/:id/publish", "content:publish", async (ctx, parts) => {
    const payload = (await ctx.request.json().catch(() => null)) as unknown;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
    const id = decodeURIComponent(parts[2]);
    const before = await getBanner(ctx.db, id);
    const result = await publishBanner(ctx.db, id, ctx.admin.username);
    if (!result.ok) {
      return err(result.code, result.message, result.code === "NOT_FOUND" ? 404 : 400);
    }
    await writeAuditLog(ctx, "banner.publish", "banner", id, reason, {
      before,
      after: result.banner,
    });
    return json({ ok: true, banner: result.banner, playerImpact: true });
  });
  post("content/banners/:id/unpublish", "content:publish", async (ctx, parts) => {
    const payload = (await ctx.request.json().catch(() => null)) as unknown;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
    const id = decodeURIComponent(parts[2]);
    const before = await getBanner(ctx.db, id);
    const result = await unpublishBanner(ctx.db, id, ctx.admin.username);
    if (!result.ok) return err(result.code, result.message, 404);
    await writeAuditLog(ctx, "banner.unpublish", "banner", id, reason, {
      before,
      after: result.banner,
    });
    return json({ ok: true, banner: result.banner, playerImpact: true });
  });

  get("content/recommended-games", "content:view", async (ctx) =>
    json({ items: await listRecommendedGames(ctx.db), officialGames: contentCenterMeta().officialGames }));
  post("content/recommended-games", "content:edit", async (ctx) => {
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
    const result = await upsertRecommendedGame(ctx.db, {
      id: typeof payload?.id === "string" ? payload.id : undefined,
      gameId: typeof payload?.gameId === "string" ? payload.gameId : "",
      sortOrder: typeof payload?.sortOrder === "number" ? payload.sortOrder : undefined,
      enabled: payload?.enabled !== false,
      tag: typeof payload?.tag === "string" ? payload.tag : null,
      coverUrl: typeof payload?.coverUrl === "string" ? payload.coverUrl : null,
      locales: payload?.locales,
      adminUsername: ctx.admin.username,
    });
    if (!result.ok) return err(result.code, result.message, 400);
    await writeAuditLog(ctx, "recommended_game.upsert", "recommended_game", result.item.id, reason, {
      before: null,
      after: result.item,
    });
    return json({ ok: true, item: result.item });
  });

  get("system/status", "system:view", async (ctx) => {
    const monitor = await getSystemMonitor(ctx.db);
    return json({
      version: {
        adminApi: ADMIN_API_VERSION,
        baseline: ADMIN_BASELINE_SHA,
        module: "R1-M9",
      },
      ...monitor,
    });
  });

  get("logs/admin", "logs:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    const dateFrom = params.get("dateFrom")?.trim() || undefined;
    const dateTo = params.get("dateTo")?.trim() || undefined;
    if (dateFrom && dateTo) {
      const fromMs = Date.parse(dateFrom.includes("T") ? dateFrom : `${dateFrom}T00:00:00Z`);
      const toMs = Date.parse(dateTo.includes("T") ? dateTo : `${dateTo}T23:59:59Z`);
      if (Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs - fromMs > 93 * 86400000) {
        return err("RANGE_TOO_LARGE", "Audit time range must be <= 93 days", 400);
      }
    }
    const result = await listAdminAuditLogs(ctx.db, {
      ...normalizePage(params),
      operator: params.get("operator") ?? undefined,
      action: params.get("action") ?? undefined,
      targetId: params.get("targetId") ?? undefined,
      role: params.get("role") ?? undefined,
      dateFrom,
      dateTo,
      highRiskOnly: params.get("highRisk") === "1" || params.get("highRisk") === "true",
    });
    const viewPii = roleHasPermission(ctx.admin.role, "players:pii:view")
      || roleHasPermission(ctx.admin.role, "risk:pii:view");
    const items = result.items.map((row) => ({
      ...row,
      ip: presentIp(row.ip ? String(row.ip) : null, {
        viewPii,
        viewDevices: viewPii,
        viewSessions: viewPii,
      }),
      ipMasked: maskIp(row.ip ? String(row.ip) : null),
    }));
    return json({
      ...result,
      items,
      immutable: true,
      export: "FUTURE",
      sources: {
        adminAction: "OK",
        adminLoginSuccess: "OK",
        adminLoginFailure: "NOT_AVAILABLE",
        playerSecurity: "PARTIAL",
        walletOps: "OK",
        riskOps: "OK",
        contentOps: "OK",
      },
    });
  });
  get("logs/game", "logs:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    return json({
      ...(await listGameAuditEvents(ctx.db, {
        ...normalizePage(params),
        playerId: params.get("playerId") ?? undefined,
        action: params.get("action") ?? undefined,
      })),
      immutable: true,
      export: "FUTURE",
    });
  });
  get("logs/security", "logs:view", async (ctx) => {
    // Player login-failure store not available — return honest capability + high-risk admin actions.
    const params = new URL(ctx.request.url).searchParams;
    const page = normalizePage(params);
    const highRisk = await listAdminAuditLogs(ctx.db, {
      ...page,
      highRiskOnly: true,
      operator: params.get("operator") ?? undefined,
      dateFrom: params.get("dateFrom") ?? undefined,
      dateTo: params.get("dateTo") ?? undefined,
    });
    return json({
      ...highRisk,
      immutable: true,
      export: "FUTURE",
      availability: {
        adminHighRiskActions: "OK",
        adminLoginFailures: "NOT_AVAILABLE",
        playerLoginFailures: "NOT_AVAILABLE",
        note: "Failed login persistence is not implemented; success admin.login is in Admin Action Audit",
      },
    });
  });

  get("admins", "admins:view", async (ctx) => json({ items: await listAdmins(ctx.db) }));
  get("admins/stats", "admins:view", async (ctx) => json(await getAdminStats(ctx.db)));
  get("admins/matrix", "admins:view", async () =>
    json({
      permissions: ADMIN_PERMISSIONS,
      dangerous: DANGEROUS_PERMISSIONS,
      modules: permissionModules(),
      roles: ADMIN_ROLES.map((role) => ({
        role,
        grants: permissionsForRole(role as AdminRole),
      })),
      roleEdit: "STATIC_MAP",
      note: "Permission matrix is read-only; ROLE_PERMISSIONS is code-defined",
    }));
  get("admins/roles", "admins:view", async (ctx) =>
    json({ items: await listRoleCatalog(ctx.db), editable: false }));
  // Literal session paths MUST be registered before admins/:id/*
  get("admins/sessions", "admins:sessions:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    return json(await listAdminSessions(ctx.db, {
      adminId: params.get("adminId") ?? undefined,
      viewerAdminId: ctx.admin.adminId,
      page: Number(params.get("page") ?? "1") || 1,
      pageSize: Number(params.get("pageSize") ?? "20") || 20,
    }));
  });
  get("admins/sessions/mine", "dashboard:view", async (ctx) =>
    json(await listAdminSessions(ctx.db, {
      adminId: ctx.admin.adminId,
      viewerAdminId: ctx.admin.adminId,
      page: 1,
      pageSize: 50,
    })));
  post("admins/sessions/revoke", "admins:sessions:revoke", async (ctx) => {
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
    const fingerprint = typeof payload?.fingerprint === "string" ? payload.fingerprint.trim() : "";
    const result = await revokeAdminSessionByFingerprint(ctx.db, fingerprint, {
      actorAdminId: ctx.admin.adminId,
      allowAny: true,
    });
    if (!result.ok) {
      return err(result.code, result.message, result.code === "FORBIDDEN" ? 403 : 400);
    }
    await writeAuditLog(ctx, "admin.session.revoke", "admin_session", result.adminId, reason, {
      before: { fingerprint },
      after: { revoked: true },
    });
    return json({ ok: true });
  });
  post("admins/sessions/logout-others", "dashboard:view", async (ctx) => {
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload) ?? "logout other sessions";
    const token = extractAdminToken(ctx.request);
    const left = await revokeOtherSessionsForAdmin(ctx.db, ctx.admin.adminId, token);
    await writeAuditLog(ctx, "admin.sessions.logout_others", "admin", ctx.admin.adminId, reason, {
      after: { remaining: left },
    });
    return json({ ok: true, remaining: left });
  });
  get("admins/:id/detail", "admins:view", async (ctx, parts) => {
    const detail = await getAdminUserDetail(ctx.db, decodeURIComponent(parts[1]));
    if (!detail) return err("NOT_FOUND", "admin not found", 404);
    return json({ admin: detail });
  });
  get("admins/:id/audit", "admins:view", async (ctx, parts) =>
    json({ items: await getAdminAuditFor(ctx.db, decodeURIComponent(parts[1])) }));
  post("admins", "admins:manage", (ctx) => handleAdminCreate(ctx));
  post("admins/:id", "admins:manage", (ctx, parts) => handleAdminUpdate(ctx, decodeURIComponent(parts[1])));

  get("security/overview", "security:view", async (ctx) =>
    json(await getAdminSecurityOverview(ctx.db)));

  get("support/tickets", "support:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    return json({
      ...(await listTickets(ctx.db, {
        page: Number(params.get("page") ?? "1") || 1,
        pageSize: Number(params.get("pageSize") ?? "20") || 20,
        status: params.get("status") ?? undefined,
        priority: params.get("priority") ?? undefined,
        category: params.get("category") ?? undefined,
        playerId: params.get("playerId") ?? undefined,
        assignedAdminId: params.get("assignedAdminId") ?? undefined,
        search: params.get("search") ?? undefined,
      })),
      meta: TICKET_META,
    });
  });
  get("support/tickets/:id", "support:view", async (ctx, parts) => {
    const detail = await getTicket(ctx.db, decodeURIComponent(parts[2]));
    if (!detail) return err("NOT_FOUND", "ticket not found", 404);
    return json({ ...detail, meta: TICKET_META });
  });
  post("support/tickets", "support:reply", async (ctx) => {
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
    if (payload?.creditPlayer || payload?.adjustBalance || payload?.confirmDeposit) {
      return err("SUPPORT_MONEY_FORBIDDEN", "Customer service cannot perform money operations");
    }
    const result = await createTicket(ctx.db, {
      playerId: typeof payload?.playerId === "string" ? payload.playerId : null,
      category: typeof payload?.category === "string" ? payload.category : "OTHER",
      subject: typeof payload?.subject === "string" ? payload.subject : "",
      priority: typeof payload?.priority === "string" ? payload.priority : "NORMAL",
      body: typeof payload?.body === "string" ? payload.body : undefined,
      related: (payload?.related && typeof payload.related === "object"
        ? payload.related
        : {}) as Record<string, string | null>,
      createdById: ctx.admin.adminId,
      createdByUsername: ctx.admin.username,
    });
    if (!result.ok) return err(result.code, result.message);
    await writeAuditLog(ctx, "ticket.create", "ticket", result.ticket.id, reason, {
      before: null,
      after: result.ticket,
    });
    return json({ ok: true, ticket: result.ticket }, 201);
  });
  post("support/tickets/:id/update", "support:assign", async (ctx, parts) => {
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload);
    if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
    const id = decodeURIComponent(parts[2]);
    // Status resolve/close needs manage; assign/priority can use assign.
    const status = typeof payload?.status === "string" ? payload.status.toUpperCase() : undefined;
    if (status && ["RESOLVED", "CLOSED"].includes(status)
      && !roleHasPermission(ctx.admin.role, "support:manage")
      && !roleHasPermission(ctx.admin.role, "support:reply")) {
      // allow reply role to resolve via manage check — require manage for CLOSED
    }
    if (status === "CLOSED" && !roleHasPermission(ctx.admin.role, "support:manage")) {
      return err("FORBIDDEN", "support:manage required to close tickets", 403);
    }
    let assignedAdminId = payload?.assignedAdminId === undefined
      ? undefined
      : (payload.assignedAdminId as string | null);
    let assignedAdminUsername = payload?.assignedAdminUsername as string | null | undefined;
    if (payload?.assignToSelf === true) {
      assignedAdminId = ctx.admin.adminId;
      assignedAdminUsername = ctx.admin.username;
    }
    const result = await updateTicket(ctx.db, {
      ticketId: id,
      status,
      priority: typeof payload?.priority === "string" ? payload.priority : undefined,
      assignedAdminId,
      assignedAdminUsername,
      related: (payload?.related && typeof payload.related === "object"
        ? payload.related
        : undefined) as Record<string, string | null> | undefined,
    });
    if (!result.ok) return err(result.code, result.message, result.code === "NOT_FOUND" ? 404 : 400);
    await writeAuditLog(ctx, "ticket.update", "ticket", id, reason, {
      before: result.before,
      after: result.after,
    });
    return json({ ok: true, ticket: result.after });
  });
  post("support/tickets/:id/reply", "support:reply", async (ctx, parts) => {
    const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
    const reason = requireReason(payload) ?? "reply";
    const id = decodeURIComponent(parts[2]);
    const isInternal = payload?.internal === true || payload?.isInternal === true;
    const result = await addTicketReply(ctx.db, {
      ticketId: id,
      authorId: ctx.admin.adminId,
      authorUsername: ctx.admin.username,
      body: typeof payload?.body === "string" ? payload.body : "",
      isInternal,
    });
    if (!result.ok) return err(result.code, result.message, result.code === "NOT_FOUND" ? 404 : 400);
    await writeAuditLog(
      ctx,
      isInternal ? "ticket.note" : "ticket.reply",
      "ticket",
      id,
      reason,
      { after: { messageId: result.id, isInternal } },
    );
    return json({ ok: true, id: result.id });
  });

  return routes;
}

const ROUTES = defineRoutes();

function matchRoute(route: RouteSpec, slug: string[]): boolean {
  if (route.segments.length !== slug.length) return false;
  return route.segments.every((segment, index) =>
    segment.startsWith(":") || segment === slug[index]);
}

export async function handleAdminApi(
  db: AdminDb,
  request: Request,
  slug: string[],
): Promise<Response> {
  await ensureAdminBootstrap(db);

  // Login is the only unauthenticated endpoint.
  if (request.method === "POST" && slug.length === 1 && slug[0] === "login") {
    return handleLogin(db, request);
  }

  const admin = await resolveAdminIdentity(db, request);
  if (!admin) {
    return err("UNAUTHORIZED", "Authentication required", 401);
  }

  const route = ROUTES.find(
    (candidate) => candidate.method === request.method && matchRoute(candidate, slug),
  );
  if (!route) {
    return err("NOT_FOUND", "Unknown admin endpoint", 404);
  }
  if (route.permission && !roleHasPermission(admin.role, route.permission)) {
    return err("FORBIDDEN", "Your role is not allowed to perform this action", 403);
  }

  const ctx: AuthedContext = {
    db,
    request,
    admin,
    ip: extractClientIp(request),
    requestId: request.headers.get("x-request-id")?.trim() || crypto.randomUUID(),
  };
  try {
    const response = await route.handler(ctx, slug);
    response.headers.set("x-request-id", ctx.requestId);
    return response;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const response = err("INTERNAL_ERROR", message, 500);
    response.headers.set("x-request-id", ctx.requestId);
    return response;
  }
}

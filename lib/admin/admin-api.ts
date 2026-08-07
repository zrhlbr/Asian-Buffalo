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
 *   - no endpoint can modify wallet, ledger, math versions or balances;
 *   - the only game-table mutation is players.status (freeze/unfreeze).
 */

import { sql } from "drizzle-orm";
import { ensureAdminBootstrap } from "./admin-bootstrap.ts";
import {
<<<<<<< Updated upstream
=======
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
>>>>>>> Stashed changes
  ADMIN_SESSION_TTL_MS,
  extractClientIp,
  generateAdminToken,
  hashAdminPassword,
  generateSalt,
  isAdminRole,
  resolveAdminIdentity,
<<<<<<< Updated upstream
=======
  ROLE_PERMISSIONS,
>>>>>>> Stashed changes
  roleHasPermission,
  type AdminIdentity,
  type AdminPermission,
} from "./admin-auth.ts";
import {
<<<<<<< Updated upstream
  getDashboardMetrics,
  getLedgerHealth,
  getMathVersionDetail,
  getPlayerDetail,
  getRiskSignals,
  getRoundDetail,
  getSystemConfig,
=======
  getAdminAuditFor,
  getAdminStats,
  getDashboardMetrics,
  getLedgerHealth,
  getMathVersionDetail,
  getOpsReport,
  getPlayerDetail,
  getRiskSignals,
  getRoundDetail,
  getSessionDetail,
  getSystemConfig,
  getSystemMonitor,
>>>>>>> Stashed changes
  listAdminAuditLogs,
  listAdmins,
  listAnnouncements,
  listGameAuditEvents,
  listLedgerAccounts,
  listLedgerBalances,
  listLedgerEntries,
  listLedgerTransactions,
  listMathVersions,
  listPlayers,
  listRounds,
<<<<<<< Updated upstream
=======
  listSessions,
>>>>>>> Stashed changes
  listWalletIntents,
  listWalletProviderOps,
  normalizePage,
  type AdminDb,
} from "./admin-queries.ts";

<<<<<<< Updated upstream
export const ADMIN_API_VERSION = "r1-m7-admin-1.0.0";
=======
export const ADMIN_API_VERSION = "r1-m9-admin-1.0.0";
export const ADMIN_BASELINE_SHA = "9654d4194d2db801467af34cef1ddc5650fd310f";

/** Permissions flagged as dangerous in the admins permission matrix. */
const DANGEROUS_PERMISSIONS: AdminPermission[] = [
  "players:freeze",
  "system:manage",
  "admins:manage",
];
>>>>>>> Stashed changes

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
};

async function writeAuditLog(
  ctx: AuthedContext,
  action: string,
  targetType: string | null,
  targetId: string | null,
  reason: string,
  detail?: unknown,
): Promise<void> {
  await ctx.db.run(sql`
    INSERT INTO admin_audit_logs
      ("id", "admin_id", "admin_username", "action", "target_type", "target_id", "reason", "ip", "detail_json")
    VALUES
      (${crypto.randomUUID()}, ${ctx.admin.adminId}, ${ctx.admin.username}, ${action},
       ${targetType}, ${targetId}, ${reason}, ${ctx.ip}, ${detail == null ? null : JSON.stringify(detail)})
  `);
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
  const auditCtx: AuthedContext = {
    db,
    request,
    ip,
    admin: { adminId: String(admin.id), username: String(admin.username), role: role as AdminIdentity["role"] },
  };
  await writeAuditLog(auditCtx, "admin.login", "admin", String(admin.id), "login", { ip });

  const response = json({
    token,
    admin: { id: String(admin.id), username: String(admin.username), role },
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
    { newStatus: target },
  );
  return json({ ok: true, playerId, status: target });
}

async function handleAnnouncementCreate(ctx: AuthedContext): Promise<Response> {
  const payload = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
  const reason = requireReason(payload);
  if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  const content = typeof payload?.content === "string" ? payload.content.trim() : "";
  const level = typeof payload?.level === "string" && ["INFO", "WARNING", "CRITICAL"].includes(payload.level)
    ? payload.level
    : "INFO";
  if (!title || !content) return err("INVALID_REQUEST", "title and content are required");
  const id = crypto.randomUUID();
  await ctx.db.run(sql`
    INSERT INTO admin_announcements ("id", "title", "content", "level", "status", "created_by")
    VALUES (${id}, ${title}, ${content}, ${level}, 'PUBLISHED', ${ctx.admin.username})
  `);
  await writeAuditLog(ctx, "announcement.create", "announcement", id, reason, { title, level });
  return json({ ok: true, id }, 201);
}

async function handleAnnouncementStatus(ctx: AuthedContext, id: string, publish: boolean): Promise<Response> {
  const payload = (await ctx.request.json().catch(() => null)) as unknown;
  const reason = requireReason(payload);
  if (!reason) return err("REASON_REQUIRED", "A reason is required for this operation");
  const status = publish ? "PUBLISHED" : "UNPUBLISHED";
  await ctx.db.run(sql`
    UPDATE admin_announcements SET status = ${status}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}
  `);
  await writeAuditLog(ctx, publish ? "announcement.publish" : "announcement.unpublish", "announcement", id, reason);
  return json({ ok: true, id, status });
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
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    return err("INVALID_REQUEST", "username must be 3-32 chars [a-zA-Z0-9_.-]");
  }
  if (password.length < 8) return err("INVALID_REQUEST", "password must be at least 8 chars");
  if (!isAdminRole(role)) return err("INVALID_REQUEST", "invalid role");

  const existing = await ctx.db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM admin_users WHERE username = ${username}
  `);
  if (Number(existing[0]?.n ?? 0) > 0) return err("DUPLICATE", "username already exists", 409);

  const salt = generateSalt();
  const passwordHash = await hashAdminPassword(password, salt);
  const id = crypto.randomUUID();
  await ctx.db.run(sql`
    INSERT INTO admin_users ("id", "username", "password_hash", "salt", "role", "status")
    VALUES (${id}, ${username}, ${passwordHash}, ${salt}, ${role}, 'ACTIVE')
  `);
  await writeAuditLog(ctx, "admin.create", "admin", id, reason, { username, role });
  return json({ ok: true, id }, 201);
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
    SELECT id, username, status FROM admin_users WHERE id = ${targetId} LIMIT 1
  `);
  const target = rows[0];
  if (!target) return err("NOT_FOUND", "admin not found", 404);

  switch (action) {
    case "disable":
    case "enable": {
      const status = action === "disable" ? "DISABLED" : "ACTIVE";
      await ctx.db.run(sql`
        UPDATE admin_users SET status = ${status}, updated_at = CURRENT_TIMESTAMP WHERE id = ${targetId}
      `);
      if (action === "disable") {
        await ctx.db.run(sql`DELETE FROM admin_sessions WHERE admin_id = ${targetId}`);
      }
      await writeAuditLog(ctx, `admin.${action}`, "admin", targetId, reason);
      return json({ ok: true, id: targetId, status });
    }
    case "change_role": {
      const role = payload?.role;
      if (!isAdminRole(role)) return err("INVALID_REQUEST", "invalid role");
      await ctx.db.run(sql`
        UPDATE admin_users SET role = ${role}, updated_at = CURRENT_TIMESTAMP WHERE id = ${targetId}
      `);
      await writeAuditLog(ctx, "admin.change_role", "admin", targetId, reason, { role });
      return json({ ok: true, id: targetId, role });
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
      await writeAuditLog(ctx, "admin.reset_password", "admin", targetId, reason);
      return json({ ok: true, id: targetId });
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

  get("me", "dashboard:view", async (ctx) => json({ admin: ctx.admin }));
  get("dashboard", "dashboard:view", async (ctx) => json(await getDashboardMetrics(ctx.db)));

  get("players", "players:view", async (ctx) =>
    json(await listPlayers(ctx.db, normalizePage(new URL(ctx.request.url).searchParams))));
  get("players/:id", "players:view", async (ctx, parts) => {
    const detail = await getPlayerDetail(ctx.db, decodeURIComponent(parts[1]));
    if (!detail) return err("NOT_FOUND", "player not found", 404);
    return json(detail);
  });
  post("players/:id/freeze", "players:freeze", (ctx, parts) =>
    handlePlayerFreeze(ctx, decodeURIComponent(parts[1]), true));
  post("players/:id/unfreeze", "players:freeze", (ctx, parts) =>
    handlePlayerFreeze(ctx, decodeURIComponent(parts[1]), false));

<<<<<<< Updated upstream
=======
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

>>>>>>> Stashed changes
  get("rounds", "rounds:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    const page = normalizePage(params);
    return json(await listRounds(ctx.db, {
      ...page,
      playerId: params.get("playerId") ?? undefined,
      sessionId: params.get("sessionId") ?? undefined,
    }));
  });
  get("rounds/:id", "rounds:view", async (ctx, parts) => {
    const detail = await getRoundDetail(ctx.db, decodeURIComponent(parts[1]));
    if (!detail) return err("NOT_FOUND", "round not found", 404);
    return json(detail);
  });

<<<<<<< Updated upstream
=======
  // Spin is the product-facing name for a settled/pending game_round (read-only alias).
  get("spins", "rounds:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    return json(await listRounds(ctx.db, {
      ...normalizePage(params),
      playerId: params.get("playerId") ?? undefined,
      sessionId: params.get("sessionId") ?? undefined,
    }));
  });
  get("spins/:id", "rounds:view", async (ctx, parts) => {
    const detail = await getRoundDetail(ctx.db, decodeURIComponent(parts[1]));
    if (!detail) return err("NOT_FOUND", "spin not found", 404);
    return json(detail);
  });

  get("reports/ops", "dashboard:view", async (ctx) => json(await getOpsReport(ctx.db)));

>>>>>>> Stashed changes
  get("wallet/intents", "wallet:view", async (ctx) => {
    const params = new URL(ctx.request.url).searchParams;
    return json(await listWalletIntents(ctx.db, {
      ...normalizePage(params),
      operation: params.get("operation") ?? undefined,
    }));
  });
  get("wallet/provider-ops", "wallet:view", async (ctx) =>
    json(await listWalletProviderOps(ctx.db, normalizePage(new URL(ctx.request.url).searchParams))));

  get("ledger/accounts", "ledger:view", async (ctx) =>
    json(await listLedgerAccounts(ctx.db, normalizePage(new URL(ctx.request.url).searchParams))));
  get("ledger/transactions", "ledger:view", async (ctx) =>
    json(await listLedgerTransactions(ctx.db, normalizePage(new URL(ctx.request.url).searchParams))));
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

  get("system/config", "system:view", async (ctx) => json({ items: await getSystemConfig(ctx.db) }));
  post("system/config", "system:manage", (ctx) => handleSystemConfigUpdate(ctx));
  get("system/announcements", "system:view", async (ctx) => json({ items: await listAnnouncements(ctx.db) }));
  post("system/announcements", "system:manage", (ctx) => handleAnnouncementCreate(ctx));
  post("system/announcements/:id/publish", "system:manage", (ctx, parts) =>
    handleAnnouncementStatus(ctx, decodeURIComponent(parts[2]), true));
  post("system/announcements/:id/unpublish", "system:manage", (ctx, parts) =>
    handleAnnouncementStatus(ctx, decodeURIComponent(parts[2]), false));
  get("system/status", "system:view", async (ctx) => {
<<<<<<< Updated upstream
    const health = await getLedgerHealth(ctx.db);
    return json({
      version: {
        adminApi: ADMIN_API_VERSION,
        baseline: "9654d4194d2db801467af34cef1ddc5650fd310f",
        module: "R1-M7",
      },
      api: { ok: true },
      database: { ok: true },
      ledger: { ok: health.ok },
      checkedAt: new Date().toISOString(),
=======
    const monitor = await getSystemMonitor(ctx.db);
    return json({
      version: {
        adminApi: ADMIN_API_VERSION,
        baseline: ADMIN_BASELINE_SHA,
        module: "R1-M9",
      },
      ...monitor,
>>>>>>> Stashed changes
    });
  });

  get("logs/admin", "logs:view", async (ctx) =>
    json(await listAdminAuditLogs(ctx.db, normalizePage(new URL(ctx.request.url).searchParams))));
  get("logs/game", "logs:view", async (ctx) =>
    json(await listGameAuditEvents(ctx.db, normalizePage(new URL(ctx.request.url).searchParams))));

  get("admins", "admins:view", async (ctx) => json({ items: await listAdmins(ctx.db) }));
<<<<<<< Updated upstream
=======
  get("admins/stats", "admins:view", async (ctx) => json(await getAdminStats(ctx.db)));
  get("admins/matrix", "admins:view", async () =>
    json({
      permissions: ADMIN_PERMISSIONS,
      dangerous: DANGEROUS_PERMISSIONS,
      roles: ADMIN_ROLES.map((role) => ({
        role,
        grants: ROLE_PERMISSIONS[role] === "*"
          ? [...ADMIN_PERMISSIONS]
          : [...(ROLE_PERMISSIONS[role] as readonly AdminPermission[])],
      })),
    }));
  get("admins/:id/audit", "admins:view", async (ctx, parts) =>
    json({ items: await getAdminAuditFor(ctx.db, decodeURIComponent(parts[1])) }));
>>>>>>> Stashed changes
  post("admins", "admins:manage", (ctx) => handleAdminCreate(ctx));
  post("admins/:id", "admins:manage", (ctx, parts) => handleAdminUpdate(ctx, decodeURIComponent(parts[1])));

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
  };
  return route.handler(ctx, slug);
}

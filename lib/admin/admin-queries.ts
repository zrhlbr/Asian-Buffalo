/**
 * R1-M7 Admin console — read models.
 *
 * Every function in this module is READ-ONLY against the game tables
 * (players / game_sessions / game_rounds / ledger_* / wallet_* /
 * game_math_versions / audit_events). The only writes anywhere in the M7
 * admin backend are:
 *   - admin-namespaced sidecar tables (admin_*), and
 *   - players.status via the freeze/unfreeze workflow (admin-api.ts).
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../../db/schema.ts";

export type AdminDb = DrizzleD1Database<typeof schema>;

export type PageQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  sort?: string;
  order?: "asc" | "desc";
};

export function normalizePage(query: URLSearchParams): PageQuery {
  const page = Math.max(1, Number(query.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.get("pageSize") ?? "20") || 20));
  const order = query.get("order") === "asc" ? "asc" : "desc";
  return {
    page,
    pageSize,
    order,
    search: query.get("search")?.trim() || undefined,
    status: query.get("status")?.trim() || undefined,
    sort: query.get("sort")?.trim() || undefined,
  };
}

/** Whitelist a sort column against a known set; falls back to created_at. */
function sortColumn(sort: string | undefined, allowed: Record<string, string>, fallback: string): string {
  if (sort && allowed[sort]) return allowed[sort];
  return fallback;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type DashboardMetrics = {
  onlineNow: number;
  todayActive: number;
  todayNew: number;
  spinCount: number;
  todayBetMinor: number;
  todayPayoutMinor: number;
  todayProfitMinor: number;
  rtpPercent: number | null;
  freeSpinsNow: number;
  anomalyCount: number;
  wallet: { byStatus: { status: string; count: number }[]; ok: boolean };
  ledger: { ok: boolean; unbalancedTx: number; projectionMismatch: number };
  api: { ok: boolean };
  system: { ok: boolean; checkedAt: string };
  hourly: { hour: string; spins: number; betMinor: number; payoutMinor: number }[];
  roundStatus: { status: string; count: number }[];
};

export async function getDashboardMetrics(db: AdminDb): Promise<DashboardMetrics> {
  const one = async (statement: ReturnType<typeof sql>): Promise<number> => {
    const rows = await db.all<{ n: number }>(statement);
    return Number(rows[0]?.n ?? 0);
  };

  const onlineNow = await one(sql`
    SELECT COUNT(*) AS n FROM game_sessions
    WHERE status = 'OPEN' AND expires_at > strftime('%Y-%m-%d %H:%M:%S', 'now')
  `);
  const todayActive = await one(sql`
    SELECT COUNT(DISTINCT player_id) AS n FROM game_rounds
    WHERE date(created_at) = date('now')
  `);
  const todayNew = await one(sql`
    SELECT COUNT(*) AS n FROM players WHERE date(created_at) = date('now')
  `);
  const spinCount = await one(sql`
    SELECT COUNT(*) AS n FROM game_rounds WHERE date(created_at) = date('now')
  `);
  const totals = await db.all<{ bet: number | null; payout: number | null }>(sql`
    SELECT COALESCE(SUM(total_bet_minor), 0) AS bet,
           COALESCE(SUM(total_win_minor), 0) AS payout
    FROM game_rounds
    WHERE date(created_at) = date('now') AND status = 'SETTLED'
  `);
  const todayBetMinor = Number(totals[0]?.bet ?? 0);
  const todayPayoutMinor = Number(totals[0]?.payout ?? 0);
  const freeSpinsNow = await one(sql`
    SELECT COALESCE(SUM(free_games_remaining), 0) AS n FROM game_sessions WHERE status = 'OPEN'
  `);
  const stuckRounds = await one(sql`
    SELECT COUNT(*) AS n FROM game_rounds
    WHERE status = 'PENDING' AND created_at < strftime('%Y-%m-%d %H:%M:%S', 'now', '-10 minutes')
  `);
  const walletIssues = await one(sql`
    SELECT COUNT(*) AS n FROM wallet_intents WHERE status IN ('UNKNOWN', 'FAILED')
  `);
  const walletByStatus = await db.all<{ status: string; count: number }>(sql`
    SELECT status, COUNT(*) AS count FROM wallet_intents GROUP BY status ORDER BY count DESC
  `);
  const roundStatus = await db.all<{ status: string; count: number }>(sql`
    SELECT status, COUNT(*) AS count FROM game_rounds GROUP BY status
  `);
  const ledgerHealth = await getLedgerHealth(db);
  const hourly = await db.all<{ hour: string; spins: number; betMinor: number; payoutMinor: number }>(sql`
    SELECT strftime('%Y-%m-%dT%H:00:00', created_at) AS hour,
           COUNT(*) AS spins,
           COALESCE(SUM(total_bet_minor), 0) AS betMinor,
           COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN total_win_minor ELSE 0 END), 0) AS payoutMinor
    FROM game_rounds
    WHERE created_at >= strftime('%Y-%m-%d %H:%M:%S', 'now', '-24 hours')
    GROUP BY hour
    ORDER BY hour
  `);

  return {
    onlineNow,
    todayActive,
    todayNew,
    spinCount,
    todayBetMinor,
    todayPayoutMinor,
    todayProfitMinor: todayBetMinor - todayPayoutMinor,
    rtpPercent: todayBetMinor > 0 ? (todayPayoutMinor / todayBetMinor) * 100 : null,
    freeSpinsNow,
    anomalyCount: stuckRounds + walletIssues,
    wallet: { byStatus: walletByStatus, ok: walletIssues === 0 },
    ledger: {
      ok: ledgerHealth.unbalancedTx === 0 && ledgerHealth.projectionMismatch === 0,
      unbalancedTx: ledgerHealth.unbalancedTx,
      projectionMismatch: ledgerHealth.projectionMismatch,
    },
    api: { ok: true },
    system: { ok: true, checkedAt: new Date().toISOString() },
    hourly,
    roundStatus,
  };
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export type PlayerListItem = {
  id: string;
  walletAdapterRef: string;
  currency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  roundCount: number;
  totalBetMinor: number;
  totalWinMinor: number;
  freeSpins: number;
  openSessions: number;
  lastActiveAt: string | null;
  // Profile/VIP sidecar (player_profiles / player_vip) — additive commerce tables.
  nickname: string | null;
  avatar: string | null;
  avatarId: string | null;
  vipLevel: number | null;
  vipStatus: string | null;
  phoneMasked: string | null;
  lastLoginAt: string | null;
  device: string | null;
  ip: string | null;
};

function maskPhoneAdmin(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `****${digits.slice(-4)}`;
}

export async function listPlayers(db: AdminDb, query: PageQuery) {
  const where: string[] = [];
  const params: string[] = [];
  if (query.search) {
    where.push("(p.id LIKE ? OR p.wallet_adapter_ref LIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like);
  }
  if (query.status) {
    where.push("p.status = ?");
    params.push(query.status);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const orderCol = sortColumn(query.sort, {
    createdAt: "p.created_at",
    updatedAt: "p.updated_at",
    currency: "p.currency",
    status: "p.status",
    roundCount: "round_count",
    totalBet: "total_bet",
  }, "p.created_at");
  const offset = (query.page - 1) * query.pageSize;

  const total = await countPlayersRaw(db, whereSql, params);
  const rows = await queryPlayersRaw(db, whereSql, params, orderCol, query.order ?? "desc", query.pageSize, offset);
  return { total, page: query.page, pageSize: query.pageSize, items: rows };
}

/**
 * Raw helpers with positional binds (drizzle sql.raw cannot bind; use $client).
 *
 * Dual-driver:
 * - better-sqlite3: `prepare(sql).all(...params)` → T[]
 * - D1: `prepare(sql).bind(...params).all()` → { results: T[] }
 * Live Admin Players 500 was caused by treating D1's result object as an array
 * (and/or passing binds via .all(...params), which D1 does not accept).
 */
async function runRaw<T>(db: AdminDb, statement: string, params: (string | number)[]): Promise<T[]> {
  type D1AllResult = { results?: T[] };
  type Prepared = {
    all: (...p: (string | number)[]) => T[] | Promise<T[] | D1AllResult>;
    bind?: (...p: (string | number)[]) => { all: () => Promise<D1AllResult> | D1AllResult };
  };
  type Client = {
    prepare: (s: string) => Prepared;
    batch?: unknown;
    transaction?: unknown;
  };
  const client = (db as unknown as { $client: Client }).$client;
  if (!client?.prepare) {
    throw new Error("Database $client.prepare is required for admin raw queries");
  }
  const prepared = client.prepare(statement);

  // D1: prefer bind()+all(); detect via batch without better-sqlite3 transaction.
  const isD1 =
    typeof client.batch === "function" && typeof client.transaction !== "function";
  if (isD1 || typeof prepared.bind === "function") {
    const bound =
      typeof prepared.bind === "function"
        ? params.length > 0
          ? prepared.bind(...params)
          : prepared.bind()
        : null;
    if (bound) {
      const raw = await bound.all();
      if (Array.isArray(raw)) return raw as T[];
      if (raw && Array.isArray(raw.results)) return raw.results;
      return [];
    }
  }

  const result = prepared.all(...params);
  const resolved = Array.isArray(result) ? result : await result;
  if (Array.isArray(resolved)) return resolved;
  if (resolved && typeof resolved === "object" && Array.isArray((resolved as D1AllResult).results)) {
    return (resolved as D1AllResult).results as T[];
  }
  throw new Error("admin runRaw: unexpected driver result shape");
}

async function countPlayersRaw(db: AdminDb, whereSql: string, params: string[]): Promise<number> {
  const rows = await runRaw<{ n: number }>(db, `SELECT COUNT(*) AS n FROM players p ${whereSql}`, params);
  return Number(rows[0]?.n ?? 0);
}

async function queryPlayersRaw(
  db: AdminDb,
  whereSql: string,
  params: string[],
  orderCol: string,
  order: string,
  limit: number,
  offset: number,
): Promise<PlayerListItem[]> {
  const rows = await runRaw<Record<string, unknown>>(db, `
    SELECT p.id, p.wallet_adapter_ref, p.currency, p.status, p.created_at, p.updated_at,
           COALESCE(r.round_count, 0) AS round_count,
           COALESCE(r.total_bet, 0) AS total_bet,
           COALESCE(r.total_win, 0) AS total_win,
           COALESCE(fs.free_spins, 0) AS free_spins,
           COALESCE(fs.open_sessions, 0) AS open_sessions,
           r.last_active_at,
           pf.nickname AS pf_nickname,
           pf.avatar_id AS pf_avatar_id,
           pf.phone_e164 AS pf_phone,
           pf.last_login_at AS pf_last_login,
           v.level AS vip_level,
           v.status AS vip_status
    FROM players p
    LEFT JOIN player_profiles pf ON pf.player_id = p.id
    LEFT JOIN player_vip v ON v.player_id = p.id
    LEFT JOIN (
      SELECT player_id, COUNT(*) AS round_count, SUM(total_bet_minor) AS total_bet,
             SUM(CASE WHEN status = 'SETTLED' THEN total_win_minor ELSE 0 END) AS total_win,
             MAX(created_at) AS last_active_at
      FROM game_rounds GROUP BY player_id
    ) r ON r.player_id = p.id
    LEFT JOIN (
      SELECT player_id, SUM(free_games_remaining) AS free_spins,
             SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open_sessions
      FROM game_sessions GROUP BY player_id
    ) fs ON fs.player_id = p.id
    ${whereSql}
    ORDER BY ${orderCol} ${order === "asc" ? "ASC" : "DESC"}
    LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}
  `, params);
  // Latest auth session IP/device (additive player_auth_sessions sidecar).
  const authMeta = new Map<string, { ip: string | null; device: string | null }>();
  try {
    const ids = rows.map((r) => String(r.id));
    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");
      const metaRows = await runRaw<Record<string, unknown>>(
        db,
        `SELECT s.player_id, s.ip, s.device
         FROM player_auth_sessions s
         INNER JOIN (
           SELECT player_id, MAX(COALESCE(last_seen_at, created_at)) AS mx
           FROM player_auth_sessions
           WHERE player_id IN (${placeholders})
           GROUP BY player_id
         ) t ON t.player_id = s.player_id
            AND COALESCE(s.last_seen_at, s.created_at) = t.mx`,
        ids,
      );
      for (const m of metaRows) {
        authMeta.set(String(m.player_id), {
          ip: m.ip ? String(m.ip) : null,
          device: m.device ? String(m.device) : null,
        });
      }
    }
  } catch {
    /* auth sidecar may not exist yet — leave ip/device null */
  }

  return rows.map((row) => {
    const avatarId = row.pf_avatar_id ? String(row.pf_avatar_id) : null;
    const meta = authMeta.get(String(row.id));
    return {
      id: String(row.id),
      walletAdapterRef: String(row.wallet_adapter_ref),
      currency: String(row.currency),
      status: String(row.status),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      roundCount: Number(row.round_count ?? 0),
      totalBetMinor: Number(row.total_bet ?? 0),
      totalWinMinor: Number(row.total_win ?? 0),
      freeSpins: Number(row.free_spins ?? 0),
      openSessions: Number(row.open_sessions ?? 0),
      lastActiveAt: row.last_active_at ? String(row.last_active_at) : null,
      nickname: row.pf_nickname ? String(row.pf_nickname) : null,
      avatar: avatarId,
      avatarId,
      vipLevel: row.vip_level == null ? null : Number(row.vip_level),
      vipStatus: row.vip_status ? String(row.vip_status) : null,
      phoneMasked: maskPhoneAdmin(row.pf_phone ? String(row.pf_phone) : null),
      lastLoginAt: row.pf_last_login ? String(row.pf_last_login) : null,
      device: meta?.device ?? null,
      ip: meta?.ip ?? null,
    };
  });
}

export async function getPlayerDetail(db: AdminDb, playerId: string) {
  const playersRows = await db.all<Record<string, unknown>>(sql`
    SELECT p.id, p.wallet_adapter_ref, p.currency, p.status, p.created_at, p.updated_at,
           pf.nickname AS pf_nickname, pf.avatar_id AS pf_avatar_id, pf.phone_e164 AS pf_phone,
           pf.last_login_at AS pf_last_login, pf.registered_at AS pf_registered,
           v.level AS vip_level, v.status AS vip_status,
           v.vip_started_at AS vip_started_at, v.vip_expires_at AS vip_expires_at
    FROM players p
    LEFT JOIN player_profiles pf ON pf.player_id = p.id
    LEFT JOIN player_vip v ON v.player_id = p.id
    WHERE p.id = ${playerId}
    LIMIT 1
  `);
  const player = playersRows[0];
  if (!player) return null;

  const aggregates = await db.all<{ round_count: number; total_bet: number; total_win: number }>(sql`
    SELECT COUNT(*) AS round_count,
           COALESCE(SUM(total_bet_minor), 0) AS total_bet,
           COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN total_win_minor ELSE 0 END), 0) AS total_win
    FROM game_rounds WHERE player_id = ${playerId}
  `);
  const sessions = await db.all<Record<string, unknown>>(sql`
    SELECT id, math_version_id, status, currency, free_games_remaining, expires_at, created_at
    FROM game_sessions WHERE player_id = ${playerId}
    ORDER BY created_at DESC LIMIT 20
  `);
  const recentRounds = await listRounds(db, { page: 1, pageSize: 10, order: "desc", playerId });
  const recentWallet = await db.all<Record<string, unknown>>(sql`
    SELECT id, operation, status, currency, amount_minor, error_code, created_at
    FROM wallet_intents WHERE player_id = ${playerId}
    ORDER BY created_at DESC LIMIT 10
  `);
  const accounts = await db.all<Record<string, unknown>>(sql`
    SELECT id, kind, currency, balance_minor, version, updated_at
    FROM ledger_accounts WHERE player_id = ${playerId}
  `);

  let authIp: string | null = null;
  let authDevice: string | null = null;
  try {
    const authRows = await db.all<Record<string, unknown>>(sql`
      SELECT ip, device FROM player_auth_sessions
      WHERE player_id = ${playerId}
      ORDER BY COALESCE(last_seen_at, created_at) DESC
      LIMIT 1
    `);
    const auth = authRows[0];
    if (auth) {
      authIp = auth.ip ? String(auth.ip) : null;
      authDevice = auth.device ? String(auth.device) : null;
    }
  } catch {
    /* sidecar optional */
  }

  const avatarId = player.pf_avatar_id ? String(player.pf_avatar_id) : null;
  return {
    player: {
      id: String(player.id),
      walletAdapterRef: String(player.wallet_adapter_ref),
      currency: String(player.currency),
      status: String(player.status),
      createdAt: String(player.created_at),
      updatedAt: String(player.updated_at),
      nickname: player.pf_nickname ? String(player.pf_nickname) : null,
      avatar: avatarId,
      avatarId,
      vipLevel: player.vip_level == null ? null : Number(player.vip_level),
      vipStatus: player.vip_status ? String(player.vip_status) : null,
      vipStartedAt: player.vip_started_at ? String(player.vip_started_at) : null,
      vipExpiresAt: player.vip_expires_at ? String(player.vip_expires_at) : null,
      phoneMasked: maskPhoneAdmin(player.pf_phone ? String(player.pf_phone) : null),
      lastLoginAt: player.pf_last_login ? String(player.pf_last_login) : null,
      registeredAt: player.pf_registered ? String(player.pf_registered) : null,
      device: authDevice,
      ip: authIp,
    },
    aggregates: {
      roundCount: Number(aggregates[0]?.round_count ?? 0),
      totalBetMinor: Number(aggregates[0]?.total_bet ?? 0),
      totalWinMinor: Number(aggregates[0]?.total_win ?? 0),
    },
    sessions,
    recentRounds: recentRounds.items,
    recentWallet,
    ledgerAccounts: accounts,
  };
}

// ---------------------------------------------------------------------------
// Game rounds
// ---------------------------------------------------------------------------

export type RoundListQuery = PageQuery & { playerId?: string; sessionId?: string };

export async function listRounds(db: AdminDb, query: RoundListQuery) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (query.search) {
    where.push("(r.id LIKE ? OR r.player_id LIKE ? OR r.session_id LIKE ? OR r.idempotency_key LIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like, like, like);
  }
  if (query.status) {
    where.push("r.status = ?");
    params.push(query.status);
  }
  if (query.playerId) {
    where.push("r.player_id = ?");
    params.push(query.playerId);
  }
  if (query.sessionId) {
    where.push("r.session_id = ?");
    params.push(query.sessionId);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const orderCol = sortColumn(query.sort, {
    createdAt: "r.created_at",
    settledAt: "r.settled_at",
    bet: "r.total_bet_minor",
    win: "r.total_win_minor",
  }, "r.created_at");
  const offset = (query.page - 1) * query.pageSize;

  const totalRows = await runRaw<{ n: number }>(db, `SELECT COUNT(*) AS n FROM game_rounds r ${whereSql}`, params);
  const rows = await runRaw<Record<string, unknown>>(db, `
    SELECT r.id, r.session_id, r.player_id, r.math_version_id, r.status, r.currency,
           r.total_bet_minor, r.total_win_minor, r.balance_after_minor, r.is_free_game,
           r.free_games_awarded, r.wallet_applied, r.idempotency_key, r.settled_at, r.created_at
    FROM game_rounds r
    ${whereSql}
    ORDER BY ${orderCol} ${query.order === "asc" ? "ASC" : "DESC"}
    LIMIT ${Math.floor(query.pageSize)} OFFSET ${Math.floor(offset)}
  `, params);

  return {
    total: Number(totalRows[0]?.n ?? 0),
    page: query.page,
    pageSize: query.pageSize,
    items: rows,
  };
}

export async function getRoundDetail(db: AdminDb, roundId: string) {
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM game_rounds WHERE id = ${roundId} LIMIT 1
  `);
  const round = rows[0];
  if (!round) return null;

  const session = await db.all<Record<string, unknown>>(sql`
    SELECT id, math_version_id, status, currency, free_games_remaining, created_at
    FROM game_sessions WHERE id = ${String(round.session_id)} LIMIT 1
  `);
  const ledgerTx = await db.all<Record<string, unknown>>(sql`
    SELECT id, kind, status, idempotency_key, posted_at FROM ledger_transactions
    WHERE round_id = ${roundId}
  `);
  const walletIntent = await db.all<Record<string, unknown>>(sql`
    SELECT i.id, i.operation, i.status, i.amount_minor, i.error_code, o.status AS provider_status
    FROM wallet_intents i
    LEFT JOIN wallet_provider_ops o ON o.intent_id = i.id
    WHERE i.ledger_tx_id IN (SELECT id FROM ledger_transactions WHERE round_id = ${roundId})
       OR i.player_id = ${String(round.player_id)} AND i.idempotency_key = ${String(round.idempotency_key)}
    ORDER BY i.created_at DESC LIMIT 5
  `);

  let outcome: unknown = null;
  if (typeof round.outcome_json === "string" && round.outcome_json.length > 0) {
    try {
      outcome = JSON.parse(round.outcome_json);
    } catch {
      outcome = { parseError: true };
    }
  }

  const extracted = extractRoundOutcome(outcome);
  const bet = Number(round.total_bet_minor ?? 0);
  const win = round.total_win_minor == null ? null : Number(round.total_win_minor);
  const balanceAfter = round.balance_after_minor == null ? null : Number(round.balance_after_minor);
  const balanceBefore = balanceAfter == null || win == null ? null : balanceAfter - win + bet;

  return { round, session: session[0] ?? null, ledgerTx, walletIntent, outcome, extracted, balanceBefore };
}

export type RoundOutcomeExtract = {
  grid: string[][] | null;
  winningPositions: { reel: number; row: number }[];
  scatterCount: number | null;
  wildCount: number | null;
  multiplier: number | null;
  mathVersion: string | null;
};

export function extractRoundOutcome(outcome: unknown): RoundOutcomeExtract {
  const result: RoundOutcomeExtract = {
    grid: null,
    winningPositions: [],
    scatterCount: null,
    wildCount: null,
    multiplier: null,
    mathVersion: null,
  };
  if (!outcome || typeof outcome !== "object") return result;
  const root = outcome as Record<string, unknown>;
  const grid = Array.isArray(root.grid) ? (root.grid as string[][]) : null;
  if (grid) {
    result.grid = grid;
    const flat = grid.flat();
    result.scatterCount = flat.filter((symbol) => symbol === "scatter").length;
    result.wildCount = flat.filter((symbol) => symbol === "wild").length;
  }
  if (Array.isArray(root.winningPositions)) {
    result.winningPositions = root.winningPositions as { reel: number; row: number }[];
  }
  const evaluation = root.evaluation as Record<string, unknown> | undefined;
  const multiplier = evaluation?.multiplier ?? root.multiplier;
  if (typeof multiplier === "number") result.multiplier = multiplier;
  if (typeof root.mathVersion === "string") result.mathVersion = root.mathVersion;
  return result;
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export async function listWalletIntents(db: AdminDb, query: PageQuery & { operation?: string }) {
  const where: string[] = [];
  const params: string[] = [];
  if (query.search) {
    where.push("(i.id LIKE ? OR i.player_id LIKE ? OR i.idempotency_key LIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like, like);
  }
  if (query.status) {
    where.push("i.status = ?");
    params.push(query.status);
  }
  if (query.operation) {
    where.push("i.operation = ?");
    params.push(query.operation);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (query.page - 1) * query.pageSize;
  const totalRows = await runRaw<{ n: number }>(db, `SELECT COUNT(*) AS n FROM wallet_intents i ${whereSql}`, params);
  const rows = await runRaw<Record<string, unknown>>(db, `
    SELECT i.id, i.player_id, i.idempotency_key, i.operation, i.status, i.currency,
           i.amount_minor, i.provider_op_id, i.ledger_tx_id, i.error_code, i.created_at, i.updated_at
    FROM wallet_intents i ${whereSql}
    ORDER BY i.created_at DESC
    LIMIT ${Math.floor(query.pageSize)} OFFSET ${Math.floor(offset)}
  `, params);
  return { total: Number(totalRows[0]?.n ?? 0), page: query.page, pageSize: query.pageSize, items: rows };
}

export async function listWalletProviderOps(db: AdminDb, query: PageQuery) {
  const where: string[] = [];
  const params: string[] = [];
  if (query.search) {
    where.push("(o.id LIKE ? OR o.intent_id LIKE ? OR o.idempotency_key LIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like, like);
  }
  if (query.status) {
    where.push("o.status = ?");
    params.push(query.status);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (query.page - 1) * query.pageSize;
  const totalRows = await runRaw<{ n: number }>(db, `SELECT COUNT(*) AS n FROM wallet_provider_ops o ${whereSql}`, params);
  const rows = await runRaw<Record<string, unknown>>(db, `
    SELECT o.id, o.intent_id, o.idempotency_key, o.status, o.currency, o.amount_minor,
           o.direction, o.created_at, o.updated_at
    FROM wallet_provider_ops o ${whereSql}
    ORDER BY o.created_at DESC
    LIMIT ${Math.floor(query.pageSize)} OFFSET ${Math.floor(offset)}
  `, params);
  return { total: Number(totalRows[0]?.n ?? 0), page: query.page, pageSize: query.pageSize, items: rows };
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export async function listLedgerAccounts(db: AdminDb, query: PageQuery) {
  const where: string[] = [];
  const params: string[] = [];
  if (query.search) {
    where.push("(a.id LIKE ? OR a.player_id LIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like);
  }
  if (query.status) {
    where.push("a.kind = ?");
    params.push(query.status);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (query.page - 1) * query.pageSize;
  const totalRows = await runRaw<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ledger_accounts a ${whereSql}`, params);
  const rows = await runRaw<Record<string, unknown>>(db, `
    SELECT a.id, a.player_id, a.kind, a.currency, a.balance_minor, a.version, a.created_at, a.updated_at
    FROM ledger_accounts a ${whereSql}
    ORDER BY a.updated_at DESC
    LIMIT ${Math.floor(query.pageSize)} OFFSET ${Math.floor(offset)}
  `, params);
  return { total: Number(totalRows[0]?.n ?? 0), page: query.page, pageSize: query.pageSize, items: rows };
}

export async function listLedgerTransactions(db: AdminDb, query: PageQuery) {
  const where: string[] = [];
  const params: string[] = [];
  if (query.search) {
    where.push("(t.id LIKE ? OR t.round_id LIKE ? OR t.idempotency_key LIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like, like);
  }
  if (query.status) {
    where.push("t.status = ?");
    params.push(query.status);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (query.page - 1) * query.pageSize;
  const totalRows = await runRaw<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ledger_transactions t ${whereSql}`, params);
  const rows = await runRaw<Record<string, unknown>>(db, `
    SELECT t.id, t.idempotency_key, t.round_id, t.kind, t.status, t.request_hash, t.posted_at, t.created_at
    FROM ledger_transactions t ${whereSql}
    ORDER BY t.created_at DESC
    LIMIT ${Math.floor(query.pageSize)} OFFSET ${Math.floor(offset)}
  `, params);
  return { total: Number(totalRows[0]?.n ?? 0), page: query.page, pageSize: query.pageSize, items: rows };
}

export async function listLedgerEntries(db: AdminDb, query: PageQuery & { transactionId?: string }) {
  const where: string[] = [];
  const params: string[] = [];
  if (query.transactionId) {
    where.push("e.transaction_id = ?");
    params.push(query.transactionId);
  } else if (query.search) {
    where.push("(e.transaction_id LIKE ? OR e.account_id LIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (query.page - 1) * query.pageSize;
  const totalRows = await runRaw<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ledger_entries e ${whereSql}`, params);
  const rows = await runRaw<Record<string, unknown>>(db, `
    SELECT e.id, e.transaction_id, e.account_id, e.sequence, e.amount_minor, e.currency,
           e.balance_after_minor, e.created_at
    FROM ledger_entries e ${whereSql}
    ORDER BY e.created_at DESC, e.sequence ASC
    LIMIT ${Math.floor(query.pageSize)} OFFSET ${Math.floor(offset)}
  `, params);
  return { total: Number(totalRows[0]?.n ?? 0), page: query.page, pageSize: query.pageSize, items: rows };
}

export async function listLedgerBalances(db: AdminDb, query: PageQuery) {
  const offset = (query.page - 1) * query.pageSize;
  const totalRows = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM ledger_balances`);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT b.account_id, b.balance_minor, b.version, b.updated_at,
           a.kind, a.player_id, a.currency, a.balance_minor AS account_balance_minor
    FROM ledger_balances b
    LEFT JOIN ledger_accounts a ON a.id = b.account_id
    ORDER BY b.updated_at DESC
    LIMIT ${query.pageSize} OFFSET ${offset}
  `);
  return { total: Number(totalRows[0]?.n ?? 0), page: query.page, pageSize: query.pageSize, items: rows };
}

export type LedgerHealth = {
  checkedTx: number;
  unbalancedTx: number;
  unbalancedIds: string[];
  projectionMismatch: number;
  mismatchAccountIds: string[];
  ok: boolean;
};

export async function getLedgerHealth(db: AdminDb): Promise<LedgerHealth> {
  const unbalanced = await db.all<{ transaction_id: string; total: number }>(sql`
    SELECT e.transaction_id, SUM(e.amount_minor) AS total
    FROM ledger_entries e
    JOIN ledger_transactions t ON t.id = e.transaction_id
    WHERE t.status = 'POSTED'
    GROUP BY e.transaction_id
    HAVING SUM(e.amount_minor) <> 0
    LIMIT 50
  `);
  const checkedTxRows = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM ledger_transactions WHERE status = 'POSTED'
  `);
  const mismatches = await db.all<{ account_id: string }>(sql`
    SELECT b.account_id
    FROM ledger_balances b
    JOIN ledger_accounts a ON a.id = b.account_id
    WHERE b.balance_minor <> a.balance_minor OR b.version <> a.version
    LIMIT 50
  `);
  const unbalancedTx = unbalanced.length;
  const projectionMismatch = mismatches.length;
  return {
    checkedTx: Number(checkedTxRows[0]?.n ?? 0),
    unbalancedTx,
    unbalancedIds: unbalanced.map((row) => row.transaction_id),
    projectionMismatch,
    mismatchAccountIds: mismatches.map((row) => row.account_id),
    ok: unbalancedTx === 0 && projectionMismatch === 0,
  };
}

// ---------------------------------------------------------------------------
// Math versions
// ---------------------------------------------------------------------------

export async function listMathVersions(db: AdminDb) {
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT id, sha256, status, config_json, activated_at, created_at FROM game_math_versions
    ORDER BY created_at DESC
  `);
  return rows.map((row) => {
    let summary: Record<string, unknown> = {};
    try {
      const config = JSON.parse(String(row.config_json ?? "{}")) as Record<string, unknown>;
      summary = {
        version: config.version ?? null,
        gameVersion: config.gameVersion ?? null,
        grid: config.grid ?? null,
        paylineCount: config.paylineCount ?? null,
        rtp: (config as Record<string, unknown>).theoreticalRtp ?? config.rtp ?? null,
      };
    } catch {
      summary = {};
    }
    return { ...row, summary };
  });
}

export async function getMathVersionDetail(db: AdminDb, id: string) {
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT id, sha256, status, config_json, activated_at, created_at
    FROM game_math_versions WHERE id = ${id} OR sha256 = ${id} LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  let config: unknown = null;
  try {
    config = JSON.parse(String(row.config_json));
  } catch {
    config = null;
  }
  return { ...row, config };
}

// ---------------------------------------------------------------------------
// Risk center
// ---------------------------------------------------------------------------

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RiskSignal = {
  type: string;
  level: RiskLevel;
  playerId: string | null;
  subjectType: string;
  subjectId: string;
  evidence: string;
  detectedAt: string | null;
};

export async function getRiskSignals(db: AdminDb): Promise<RiskSignal[]> {
  const signals: RiskSignal[] = [];

  const abnormalBets = await db.all<Record<string, unknown>>(sql`
    SELECT id, player_id, total_bet_minor, created_at FROM game_rounds
    WHERE total_bet_minor >= 1000000 ORDER BY total_bet_minor DESC LIMIT 50
  `);
  for (const row of abnormalBets) {
    const bet = Number(row.total_bet_minor);
    signals.push({
      type: "ABNORMAL_BET",
      level: bet >= 5_000_000 ? "HIGH" : "MEDIUM",
      playerId: String(row.player_id),
      subjectType: "round",
      subjectId: String(row.id),
      evidence: `total_bet_minor=${bet}`,
      detectedAt: String(row.created_at),
    });
  }

  const abnormalWins = await db.all<Record<string, unknown>>(sql`
    SELECT id, player_id, total_bet_minor, total_win_minor, created_at FROM game_rounds
    WHERE status = 'SETTLED'
      AND (total_win_minor >= 5000000
           OR (total_bet_minor > 0 AND total_win_minor >= total_bet_minor * 100))
    ORDER BY total_win_minor DESC LIMIT 50
  `);
  for (const row of abnormalWins) {
    signals.push({
      type: "ABNORMAL_WIN",
      level: "HIGH",
      playerId: String(row.player_id),
      subjectType: "round",
      subjectId: String(row.id),
      evidence: `bet=${Number(row.total_bet_minor)} win=${Number(row.total_win_minor)}`,
      detectedAt: String(row.created_at),
    });
  }

  const duplicateRequests = await db.all<Record<string, unknown>>(sql`
    SELECT player_id, request_hash, COUNT(*) AS n, MAX(created_at) AS last_seen
    FROM game_rounds GROUP BY player_id, request_hash
    HAVING COUNT(*) > 1 ORDER BY n DESC LIMIT 20
  `);
  for (const row of duplicateRequests) {
    signals.push({
      type: "DUPLICATE_REQUEST",
      level: "MEDIUM",
      playerId: String(row.player_id),
      subjectType: "request_hash",
      subjectId: String(row.request_hash).slice(0, 16),
      evidence: `same request_hash x${Number(row.n)}`,
      detectedAt: String(row.last_seen),
    });
  }

  const duplicateSettlements = await db.all<Record<string, unknown>>(sql`
    SELECT round_id, COUNT(*) AS n FROM ledger_transactions
    WHERE kind = 'GAME_PAYOUT' AND round_id IS NOT NULL
    GROUP BY round_id HAVING COUNT(*) > 1 LIMIT 20
  `);
  for (const row of duplicateSettlements) {
    signals.push({
      type: "DUPLICATE_SETTLEMENT",
      level: "CRITICAL",
      playerId: null,
      subjectType: "round",
      subjectId: String(row.round_id),
      evidence: `GAME_PAYOUT transactions x${Number(row.n)}`,
      detectedAt: null,
    });
  }

  const providerTimeouts = await db.all<Record<string, unknown>>(sql`
    SELECT id, intent_id, status, updated_at FROM wallet_provider_ops
    WHERE status = 'UNKNOWN' ORDER BY updated_at DESC LIMIT 50
  `);
  for (const row of providerTimeouts) {
    signals.push({
      type: "PROVIDER_TIMEOUT",
      level: "MEDIUM",
      playerId: null,
      subjectType: "provider_op",
      subjectId: String(row.id),
      evidence: `intent=${String(row.intent_id)} status=UNKNOWN`,
      detectedAt: String(row.updated_at),
    });
  }

  const mathMismatches = await db.all<Record<string, unknown>>(sql`
    SELECT r.id, r.player_id, r.math_version_id AS round_math, s.math_version_id AS session_math, r.created_at
    FROM game_rounds r JOIN game_sessions s ON s.id = r.session_id
    WHERE r.math_version_id <> s.math_version_id LIMIT 20
  `);
  for (const row of mathMismatches) {
    signals.push({
      type: "MATH_MISMATCH",
      level: "CRITICAL",
      playerId: String(row.player_id),
      subjectType: "round",
      subjectId: String(row.id),
      evidence: `round_math=${String(row.round_math)} session_math=${String(row.session_math)}`,
      detectedAt: String(row.created_at),
    });
  }

  const recoveries = await db.all<Record<string, unknown>>(sql`
    SELECT id, player_id, status, updated_at FROM wallet_intents
    WHERE status = 'RECOVERED' ORDER BY updated_at DESC LIMIT 20
  `);
  for (const row of recoveries) {
    signals.push({
      type: "RECOVERY",
      level: "LOW",
      playerId: String(row.player_id),
      subjectType: "wallet_intent",
      subjectId: String(row.id),
      evidence: "intent RECOVERED",
      detectedAt: String(row.updated_at),
    });
  }

  const negativeBalances = await db.all<Record<string, unknown>>(sql`
    SELECT id, player_id, kind, balance_minor, updated_at FROM ledger_accounts
    WHERE balance_minor < 0 AND kind = 'PLAYER_AVAILABLE' LIMIT 20
  `);
  for (const row of negativeBalances) {
    signals.push({
      type: "ABNORMAL_BALANCE",
      level: "CRITICAL",
      playerId: row.player_id ? String(row.player_id) : null,
      subjectType: "ledger_account",
      subjectId: String(row.id),
      evidence: `balance_minor=${Number(row.balance_minor)}`,
      detectedAt: String(row.updated_at),
    });
  }

  const manySessions = await db.all<Record<string, unknown>>(sql`
    SELECT player_id, COUNT(*) AS n, MAX(created_at) AS last_seen FROM game_sessions
    WHERE status = 'OPEN' GROUP BY player_id HAVING COUNT(*) > 5
    ORDER BY n DESC LIMIT 20
  `);
  for (const row of manySessions) {
    signals.push({
      type: "DANGEROUS_BEHAVIOR",
      level: "MEDIUM",
      playerId: String(row.player_id),
      subjectType: "player",
      subjectId: String(row.player_id),
      evidence: `open_sessions=${Number(row.n)}`,
      detectedAt: String(row.last_seen),
    });
  }

  const ledgerHealth = await getLedgerHealth(db);
  if (!ledgerHealth.ok) {
    signals.push({
      type: "ABNORMAL_BALANCE",
      level: "HIGH",
      playerId: null,
      subjectType: "ledger",
      subjectId: "ledger-health",
      evidence: `unbalanced_tx=${ledgerHealth.unbalancedTx} projection_mismatch=${ledgerHealth.projectionMismatch}`,
      detectedAt: null,
    });
  }

  const levelWeight: Record<RiskLevel, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  signals.sort((a, b) => levelWeight[a.level] - levelWeight[b.level]);
  return signals;
}

// ---------------------------------------------------------------------------
// System / logs
// ---------------------------------------------------------------------------

export async function listAnnouncements(db: AdminDb) {
  return db.all<Record<string, unknown>>(sql`
    SELECT id, title, content, level, status, created_by, created_at, updated_at
    FROM admin_announcements ORDER BY created_at DESC LIMIT 100
  `);
}

export async function getSystemConfig(db: AdminDb) {
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT "key", value_json, updated_by, updated_at FROM admin_system_config
  `);
  return rows.map((row) => {
    let value: unknown = null;
    try {
      value = JSON.parse(String(row.value_json));
    } catch {
      value = row.value_json;
    }
    return { key: row.key, value, updatedBy: row.updated_by, updatedAt: row.updated_at };
  });
}

export async function listAdminAuditLogs(db: AdminDb, query: PageQuery) {
  const where: string[] = [];
  const params: string[] = [];
  if (query.search) {
    where.push("(l.admin_username LIKE ? OR l.action LIKE ? OR l.target_id LIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like, like);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (query.page - 1) * query.pageSize;
  const totalRows = await runRaw<{ n: number }>(db, `SELECT COUNT(*) AS n FROM admin_audit_logs l ${whereSql}`, params);
  const rows = await runRaw<Record<string, unknown>>(db, `
    SELECT l.id, l.admin_id, l.admin_username, l.action, l.target_type, l.target_id,
           l.reason, l.ip, l.detail_json, l.created_at
    FROM admin_audit_logs l ${whereSql}
    ORDER BY l.created_at DESC
    LIMIT ${Math.floor(query.pageSize)} OFFSET ${Math.floor(offset)}
  `, params);
  return { total: Number(totalRows[0]?.n ?? 0), page: query.page, pageSize: query.pageSize, items: rows };
}

export async function listGameAuditEvents(db: AdminDb, query: PageQuery) {
  const where: string[] = [];
  const params: string[] = [];
  if (query.search) {
    where.push("(e.actor_id LIKE ? OR e.event_type LIKE ? OR e.subject_id LIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like, like);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (query.page - 1) * query.pageSize;
  const totalRows = await runRaw<{ n: number }>(db, `SELECT COUNT(*) AS n FROM audit_events e ${whereSql}`, params);
  const rows = await runRaw<Record<string, unknown>>(db, `
    SELECT e.id, e.actor_type, e.actor_id, e.event_type, e.subject_type, e.subject_id,
           e.event_hash, e.created_at
    FROM audit_events e ${whereSql}
    ORDER BY e.created_at DESC
    LIMIT ${Math.floor(query.pageSize)} OFFSET ${Math.floor(offset)}
  `, params);
  return { total: Number(totalRows[0]?.n ?? 0), page: query.page, pageSize: query.pageSize, items: rows };
}

// ---------------------------------------------------------------------------
// Admins
// ---------------------------------------------------------------------------

export async function listAdmins(db: AdminDb) {
  return db.all<Record<string, unknown>>(sql`
    SELECT u.id, u.username, u.role, u.status, u.last_login_at, u.created_at, u.updated_at,
           (SELECT s.ip FROM admin_sessions s WHERE s.admin_id = u.id
            ORDER BY s.created_at DESC LIMIT 1) AS last_login_ip,
           (SELECT COUNT(*) FROM admin_audit_logs l WHERE l.admin_id = u.id) AS op_count,
           (SELECT COUNT(*) FROM admin_audit_logs l
            WHERE l.admin_id = u.id AND l.action IN
              ('player.freeze', 'player.unfreeze', 'system.config.update',
               'admin.create', 'admin.disable', 'admin.change_role', 'admin.reset_password')) AS risk_op_count
    FROM admin_users u
    ORDER BY u.created_at ASC
  `);
}

/** Recent audit rows for one admin (read-only stats panel). */
export async function getAdminAuditFor(db: AdminDb, adminId: string, limit = 20) {
  return db.all<Record<string, unknown>>(sql`
    SELECT id, action, target_type, target_id, reason, ip, created_at
    FROM admin_audit_logs WHERE admin_id = ${adminId}
    ORDER BY created_at DESC LIMIT ${limit}
  `);
}

export async function getAdminStats(db: AdminDb) {
  const rows = await db.all<{ status: string; n: number; role: string }>(sql`
    SELECT status, role, COUNT(*) AS n FROM admin_users GROUP BY status, role
  `);
  let active = 0;
  let disabled = 0;
  const byRole: Record<string, number> = {};
  for (const row of rows) {
    const n = Number(row.n ?? 0);
    if (row.status === "ACTIVE") active += n;
    else disabled += n;
    byRole[String(row.role)] = (byRole[String(row.role)] ?? 0) + n;
  }
  const opTotal = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM admin_audit_logs`);
  const riskOps = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM admin_audit_logs WHERE action IN
      ('player.freeze', 'player.unfreeze', 'system.config.update',
       'admin.create', 'admin.disable', 'admin.change_role', 'admin.reset_password')
  `);
  return {
    active,
    disabled,
    total: active + disabled,
    byRole,
    auditTotal: Number(opTotal[0]?.n ?? 0),
    riskOpTotal: Number(riskOps[0]?.n ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Game sessions (read-only)
// ---------------------------------------------------------------------------

export type SessionListQuery = PageQuery & { playerId?: string };

export async function listSessions(db: AdminDb, query: SessionListQuery) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (query.search) {
    where.push("(s.id LIKE ? OR s.player_id LIKE ? OR s.math_version_id LIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like, like);
  }
  if (query.status) {
    where.push("s.status = ?");
    params.push(query.status);
  }
  if (query.playerId) {
    where.push("s.player_id = ?");
    params.push(query.playerId);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const orderCol = sortColumn(query.sort, {
    createdAt: "s.created_at",
    expiresAt: "s.expires_at",
  }, "s.created_at");
  const offset = (query.page - 1) * query.pageSize;

  const totalRows = await runRaw<{ n: number }>(db, `SELECT COUNT(*) AS n FROM game_sessions s ${whereSql}`, params);
  const rows = await runRaw<Record<string, unknown>>(db, `
    SELECT s.id, s.player_id, s.math_version_id, s.status, s.currency,
           s.free_games_remaining, s.expires_at, s.created_at, s.updated_at,
           COALESCE(r.round_count, 0) AS round_count,
           COALESCE(r.total_bet, 0) AS total_bet,
           COALESCE(r.total_win, 0) AS total_win
    FROM game_sessions s
    LEFT JOIN (
      SELECT session_id, COUNT(*) AS round_count,
             SUM(total_bet_minor) AS total_bet,
             SUM(CASE WHEN status = 'SETTLED' THEN total_win_minor ELSE 0 END) AS total_win
      FROM game_rounds GROUP BY session_id
    ) r ON r.session_id = s.id
    ${whereSql}
    ORDER BY ${orderCol} ${query.order === "asc" ? "ASC" : "DESC"}
    LIMIT ${Math.floor(query.pageSize)} OFFSET ${Math.floor(offset)}
  `, params);

  return {
    total: Number(totalRows[0]?.n ?? 0),
    page: query.page,
    pageSize: query.pageSize,
    items: rows,
  };
}

export async function getSessionDetail(db: AdminDb, sessionId: string) {
  const sessions = await db.all<Record<string, unknown>>(sql`
    SELECT id, player_id, math_version_id, status, currency, free_games_remaining,
           expires_at, created_at, updated_at
    FROM game_sessions WHERE id = ${sessionId} LIMIT 1
  `);
  const session = sessions[0];
  if (!session) return null;

  const player = await db.all<Record<string, unknown>>(sql`
    SELECT id, wallet_adapter_ref, currency, status, created_at, updated_at
    FROM players WHERE id = ${String(session.player_id)} LIMIT 1
  `);
  const rounds = await listRounds(db, { page: 1, pageSize: 50, order: "desc", sessionId });
  const aggregates = await db.all<{ round_count: number; total_bet: number; total_win: number }>(sql`
    SELECT COUNT(*) AS round_count,
           COALESCE(SUM(total_bet_minor), 0) AS total_bet,
           COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN total_win_minor ELSE 0 END), 0) AS total_win
    FROM game_rounds WHERE session_id = ${sessionId}
  `);

  return {
    session,
    player: player[0] ?? null,
    aggregates: {
      roundCount: Number(aggregates[0]?.round_count ?? 0),
      totalBetMinor: Number(aggregates[0]?.total_bet ?? 0),
      totalWinMinor: Number(aggregates[0]?.total_win ?? 0),
    },
    rounds: rounds.items,
  };
}

// ---------------------------------------------------------------------------
// Ops reports / monitoring (read-only aggregations)
// ---------------------------------------------------------------------------

export async function getOpsReport(db: AdminDb) {
  const dash = await getDashboardMetrics(db);
  const topPlayers = await db.all<Record<string, unknown>>(sql`
    SELECT player_id,
           COUNT(*) AS spin_count,
           COALESCE(SUM(total_bet_minor), 0) AS total_bet,
           COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN total_win_minor ELSE 0 END), 0) AS total_win
    FROM game_rounds
    WHERE date(created_at) = date('now')
    GROUP BY player_id
    ORDER BY total_bet DESC
    LIMIT 20
  `);
  const sessionStatus = await db.all<{ status: string; count: number }>(sql`
    SELECT status, COUNT(*) AS count FROM game_sessions GROUP BY status
  `);
  const walletByOp = await db.all<{ operation: string; status: string; count: number }>(sql`
    SELECT operation, status, COUNT(*) AS count FROM wallet_intents
    WHERE date(created_at) = date('now')
    GROUP BY operation, status
  `);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      onlineNow: dash.onlineNow,
      todayActive: dash.todayActive,
      spinCount: dash.spinCount,
      todayBetMinor: dash.todayBetMinor,
      todayPayoutMinor: dash.todayPayoutMinor,
      todayProfitMinor: dash.todayProfitMinor,
      rtpPercent: dash.rtpPercent,
      anomalyCount: dash.anomalyCount,
    },
    hourly: dash.hourly,
    roundStatus: dash.roundStatus,
    sessionStatus,
    walletByOp,
    topPlayers: topPlayers.map((row) => ({
      playerId: String(row.player_id),
      spinCount: Number(row.spin_count ?? 0),
      totalBetMinor: Number(row.total_bet ?? 0),
      totalWinMinor: Number(row.total_win ?? 0),
    })),
    health: {
      wallet: dash.wallet.ok,
      ledger: dash.ledger.ok,
      api: dash.api.ok,
      system: dash.system.ok,
    },
  };
}

export async function getSystemMonitor(db: AdminDb) {
  const health = await getLedgerHealth(db);
  const openSessions = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM game_sessions
    WHERE status = 'OPEN' AND expires_at > strftime('%Y-%m-%d %H:%M:%S', 'now')
  `);
  const pendingRounds = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM game_rounds WHERE status = 'PENDING'
  `);
  const walletFailed = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM wallet_intents
    WHERE status IN ('FAILED', 'UNKNOWN') AND date(created_at) = date('now')
  `);
  const risk = await getRiskSignals(db);
  const critical = risk.filter((s) => s.level === "CRITICAL").length;
  const high = risk.filter((s) => s.level === "HIGH").length;
  const adminStats = await getAdminStats(db);

  return {
    api: { ok: true },
    database: { ok: true },
    ledger: {
      ok: health.ok,
      unbalancedTx: health.unbalancedTx,
      projectionMismatch: health.projectionMismatch,
    },
    sessions: { open: Number(openSessions[0]?.n ?? 0) },
    rounds: { pending: Number(pendingRounds[0]?.n ?? 0) },
    wallet: { failedToday: Number(walletFailed[0]?.n ?? 0) },
    risk: { critical, high, total: risk.length },
    admins: adminStats,
    checkedAt: new Date().toISOString(),
  };
}

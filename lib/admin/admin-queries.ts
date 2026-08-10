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
import {
  presentDevice,
  presentEmail,
  presentIp,
  presentPhone,
  presentSessionId,
  type PiiViewOptions,
} from "./admin-pii.ts";
import { ensureWalletCommerceReady } from "../wallet-commerce-bootstrap.ts";
import { sumFrozenWithdrawals } from "../withdrawal-service.ts";

export type AdminDb = DrizzleD1Database<typeof schema>;

export type PageQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  kind?: string;
  sort?: string;
  order?: "asc" | "desc";
  online?: "online" | "offline";
  vipMin?: number;
  registeredFrom?: string;
  registeredTo?: string;
  riskTagged?: boolean;
};

export function normalizePage(query: URLSearchParams): PageQuery {
  const page = Math.max(1, Number(query.get("page") ?? "1") || 1);
  const rawSize = Number(query.get("pageSize") ?? "20") || 20;
  const pageSize = [20, 50, 100].includes(rawSize) ? rawSize : Math.min(100, Math.max(1, rawSize));
  const order = query.get("order") === "asc" ? "asc" : "desc";
  const onlineRaw = query.get("online")?.trim();
  const online = onlineRaw === "online" || onlineRaw === "offline" ? onlineRaw : undefined;
  const vipMinRaw = query.get("vipMin");
  const vipMin = vipMinRaw != null && vipMinRaw !== "" ? Number(vipMinRaw) : undefined;
  return {
    page,
    pageSize,
    order,
    search: query.get("search")?.trim() || undefined,
    status: query.get("status")?.trim() || undefined,
    kind: query.get("kind")?.trim() || undefined,
    sort: query.get("sort")?.trim() || undefined,
    online,
    vipMin: vipMin != null && Number.isFinite(vipMin) ? vipMin : undefined,
    registeredFrom: query.get("registeredFrom")?.trim() || undefined,
    registeredTo: query.get("registeredTo")?.trim() || undefined,
    riskTagged: query.get("risk") === "1" || query.get("risk") === "true",
  };
}

export type MetricAvailability = "OK" | "NOT_AVAILABLE" | "ERROR";

export type DashboardMetricCell = {
  value: number | null;
  availability: MetricAvailability;
  source: string;
  error?: string;
};

function metricOk(value: number, source: string): DashboardMetricCell {
  return { value, availability: "OK", source };
}
function metricNa(source: string, error?: string): DashboardMetricCell {
  return { value: null, availability: "NOT_AVAILABLE", source, error };
}
function metricErr(source: string, error: string): DashboardMetricCell {
  return { value: null, availability: "ERROR", source, error };
}

let dashboardCache: { at: number; payload: DashboardMetrics } | null = null;
const DASHBOARD_CACHE_TTL_MS = 8_000;

export function resetDashboardCacheForTests(): void {
  dashboardCache = null;
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
  /** Structured metric cells — prefer these for UI (distinguish 0 vs unavailable). */
  metrics: {
    totalPlayers: DashboardMetricCell;
    todayNew: DashboardMetricCell;
    onlineNow: DashboardMetricCell;
    todayLoginPlayers: DashboardMetricCell;
    todayActivePlayers: DashboardMetricCell;
    todayGamePlayers: DashboardMetricCell;
    todayRounds: DashboardMetricCell;
    todaySpins: DashboardMetricCell;
    todayBetMinor: DashboardMetricCell;
    todayPayoutMinor: DashboardMetricCell;
    todayProfitMinor: DashboardMetricCell;
  };
  sources: Record<string, string>;
  cached: boolean;
  cacheTtlMs: number;
  // Legacy flat fields (compat with prior Admin UI / tests)
  onlineNow: number;
  todayActive: number;
  todayNew: number;
  totalPlayers: number;
  spinCount: number;
  todayBetMinor: number;
  todayPayoutMinor: number;
  todayProfitMinor: number;
  rtpPercent: number | null;
  freeSpinsNow: number;
  anomalyCount: number;
  todayDepositCount: number;
  todayWithdrawCount: number;
  pendingWithdrawCount: number;
  pendingDepositCount: number;
  /** Prefer metrics.todayDepositCount etc. for 0 vs NOT_AVAILABLE. */
  moneyMetrics: {
    todayDepositCount: DashboardMetricCell;
    todayWithdrawCount: DashboardMetricCell;
    pendingDepositCount: DashboardMetricCell;
    pendingWithdrawCount: DashboardMetricCell;
  };
  moneyGate: {
    productionMoney: false;
    providerConfigured: false;
    realMoneyProvider: "NOT_CONFIGURED";
    gate: "CLOSED";
    testHarnessEnabled: boolean;
  };
  openRoundCount: number;
  wallet: { byStatus: { status: string; count: number }[]; ok: boolean };
  ledger: { ok: boolean; unbalancedTx: number; projectionMismatch: number };
  api: { ok: boolean; probed: boolean };
  system: { ok: boolean; probed: boolean; checkedAt: string };
  hourly: { hour: string; spins: number; betMinor: number; payoutMinor: number }[];
  sparklineSpins: number[];
  byCurrency: { currency: string; spins: number; betMinor: number; payoutMinor: number }[];
  roundStatus: { status: string; count: number }[];
  /** Last 7 calendar days — real aggregates, no fake series. */
  trend7d: {
    day: string;
    activePlayers: number;
    newPlayers: number;
    gamePlayers: number;
    rounds: number;
    betMinor: number;
    payoutMinor: number;
    profitMinor: number;
  }[];
};

export async function getDashboardMetrics(db: AdminDb): Promise<DashboardMetrics> {
  if (dashboardCache && Date.now() - dashboardCache.at < DASHBOARD_CACHE_TTL_MS) {
    return { ...dashboardCache.payload, cached: true };
  }

  const one = async (statement: ReturnType<typeof sql>): Promise<number> => {
    const rows = await db.all<{ n: number }>(statement);
    return Number(rows[0]?.n ?? 0);
  };
  const tryOne = async (
    source: string,
    statement: ReturnType<typeof sql>,
  ): Promise<DashboardMetricCell> => {
    try {
      return metricOk(await one(statement), source);
    } catch (cause) {
      return metricErr(source, cause instanceof Error ? cause.message : String(cause));
    }
  };

  const totalPlayers = await tryOne("players.count", sql`SELECT COUNT(*) AS n FROM players`);
  const todayNew = await tryOne(
    "players.created_at=today",
    sql`SELECT COUNT(*) AS n FROM players WHERE date(created_at) = date('now')`,
  );
  const onlineNow = await tryOne(
    "game_sessions.OPEN.unexpired",
    sql`
      SELECT COUNT(*) AS n FROM game_sessions
      WHERE status = 'OPEN' AND expires_at > strftime('%Y-%m-%d %H:%M:%S', 'now')
    `,
  );
  const todayGamePlayers = await tryOne(
    "game_rounds.distinct_player_id=today",
    sql`SELECT COUNT(DISTINCT player_id) AS n FROM game_rounds WHERE date(created_at) = date('now')`,
  );
  // Login metric: player_profiles.last_login_at — NOT game rounds.
  let todayLoginPlayers: DashboardMetricCell;
  try {
    const n = await one(sql`
      SELECT COUNT(*) AS n FROM player_profiles
      WHERE last_login_at IS NOT NULL AND date(last_login_at) = date('now')
    `);
    todayLoginPlayers = metricOk(n, "player_profiles.last_login_at=today");
  } catch (cause) {
    todayLoginPlayers = metricNa(
      "player_profiles.last_login_at",
      cause instanceof Error ? cause.message : "profile login source unavailable",
    );
  }
  // Active today = players with login today OR game activity today (union when login OK).
  let todayActivePlayers: DashboardMetricCell;
  if (todayLoginPlayers.availability === "OK" && todayGamePlayers.availability === "OK") {
    try {
      const n = await one(sql`
        SELECT COUNT(*) AS n FROM (
          SELECT player_id AS id FROM player_profiles
          WHERE last_login_at IS NOT NULL AND date(last_login_at) = date('now')
          UNION
          SELECT DISTINCT player_id AS id FROM game_rounds WHERE date(created_at) = date('now')
        )
      `);
      todayActivePlayers = metricOk(n, "union(login_today, game_rounds_today)");
    } catch (cause) {
      todayActivePlayers = metricOk(
        Number(todayGamePlayers.value ?? 0),
        "game_rounds.distinct_player_id=today (fallback)",
      );
      todayActivePlayers.error = cause instanceof Error ? cause.message : String(cause);
    }
  } else if (todayGamePlayers.availability === "OK") {
    todayActivePlayers = {
      ...todayGamePlayers,
      source: "game_rounds.distinct_player_id=today (login source unavailable)",
    };
  } else {
    todayActivePlayers = metricNa("active_players", "login and game sources unavailable");
  }

  const todayRounds = await tryOne(
    "game_rounds.count=today",
    sql`SELECT COUNT(*) AS n FROM game_rounds WHERE date(created_at) = date('now')`,
  );
  // Product: Spin is alias of Round in this schema — same source, labeled honestly.
  const todaySpins = todayRounds.availability === "OK"
    ? metricOk(Number(todayRounds.value ?? 0), "game_rounds.count=today (spin≡round)")
    : todayRounds;

  let todayBetMinor = metricNa("game_rounds.settled.bet");
  let todayPayoutMinor = metricNa("game_rounds.settled.win");
  try {
    const totals = await db.all<{ bet: number | null; payout: number | null }>(sql`
      SELECT COALESCE(SUM(total_bet_minor), 0) AS bet,
             COALESCE(SUM(total_win_minor), 0) AS payout
      FROM game_rounds
      WHERE date(created_at) = date('now') AND status = 'SETTLED'
    `);
    todayBetMinor = metricOk(Number(totals[0]?.bet ?? 0), "game_rounds.settled.total_bet_minor");
    todayPayoutMinor = metricOk(Number(totals[0]?.payout ?? 0), "game_rounds.settled.total_win_minor");
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    todayBetMinor = metricErr("game_rounds.settled.total_bet_minor", msg);
    todayPayoutMinor = metricErr("game_rounds.settled.total_win_minor", msg);
  }
  const todayProfitMinor =
    todayBetMinor.availability === "OK" && todayPayoutMinor.availability === "OK"
      ? metricOk(
          Number(todayBetMinor.value ?? 0) - Number(todayPayoutMinor.value ?? 0),
          "derived(bet-payout)",
        )
      : metricNa("derived(bet-payout)", "bet/payout unavailable");

  const freeSpinsNow = await tryOne(
    "game_sessions.OPEN.free_games_remaining",
    sql`SELECT COALESCE(SUM(free_games_remaining), 0) AS n FROM game_sessions WHERE status = 'OPEN'`,
  );
  const stuckRounds = await tryOne(
    "game_rounds.PENDING.stale>10m",
    sql`
      SELECT COUNT(*) AS n FROM game_rounds
      WHERE status = 'PENDING' AND created_at < strftime('%Y-%m-%d %H:%M:%S', 'now', '-10 minutes')
    `,
  );
  const walletIssues = await tryOne(
    "wallet_intents.UNKNOWN|FAILED",
    sql`SELECT COUNT(*) AS n FROM wallet_intents WHERE status IN ('UNKNOWN', 'FAILED')`,
  );

  let walletByStatus: { status: string; count: number }[] = [];
  try {
    walletByStatus = await db.all<{ status: string; count: number }>(sql`
      SELECT status, COUNT(*) AS count FROM wallet_intents GROUP BY status ORDER BY count DESC
    `);
  } catch {
    walletByStatus = [];
  }
  let roundStatus: { status: string; count: number }[] = [];
  try {
    roundStatus = await db.all<{ status: string; count: number }>(sql`
      SELECT status, COUNT(*) AS count FROM game_rounds GROUP BY status
    `);
  } catch {
    roundStatus = [];
  }
  const openRoundCount = await tryOne(
    "game_rounds.PENDING",
    sql`SELECT COUNT(*) AS n FROM game_rounds WHERE status = 'PENDING'`,
  );

  // Deposit/withdraw: ERROR if table missing — do not coerce to 0 success.
  const todayDepositCount = await tryOne(
    "deposit_orders.count=today",
    sql`SELECT COUNT(*) AS n FROM deposit_orders WHERE date(created_at) = date('now')`,
  );
  const todayWithdrawCount = await tryOne(
    "withdrawal_requests.count=today",
    sql`SELECT COUNT(*) AS n FROM withdrawal_requests WHERE date(created_at) = date('now')`,
  );
  const pendingDepositCount = await tryOne(
    "deposit_orders.pending_pipeline",
    sql`
      SELECT COUNT(*) AS n FROM deposit_orders
      WHERE status IN ('CREATED', 'PENDING', 'PROCESSING')
    `,
  );
  const pendingWithdrawCount = await tryOne(
    "withdrawal_requests.pending_pipeline",
    sql`
      SELECT COUNT(*) AS n FROM withdrawal_requests
      WHERE status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'PAYING')
    `,
  );

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
  const byCurrency = await db.all<{ currency: string; spins: number; betMinor: number; payoutMinor: number }>(sql`
    SELECT currency,
           COUNT(*) AS spins,
           COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN total_bet_minor ELSE 0 END), 0) AS betMinor,
           COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN total_win_minor ELSE 0 END), 0) AS payoutMinor
    FROM game_rounds
    WHERE date(created_at) = date('now')
    GROUP BY currency
    ORDER BY spins DESC
  `);
  const activeByDay = await db.all<{
    day: string;
    activePlayers: number;
    rounds: number;
    betMinor: number;
    payoutMinor: number;
  }>(sql`
    SELECT date(created_at) AS day,
           COUNT(DISTINCT player_id) AS activePlayers,
           COUNT(*) AS rounds,
           COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN total_bet_minor ELSE 0 END), 0) AS betMinor,
           COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN total_win_minor ELSE 0 END), 0) AS payoutMinor
    FROM game_rounds
    WHERE date(created_at) >= date('now', '-6 days')
    GROUP BY day
    ORDER BY day
  `);
  const newByDay = await db.all<{ day: string; newPlayers: number }>(sql`
    SELECT date(created_at) AS day, COUNT(*) AS newPlayers
    FROM players
    WHERE date(created_at) >= date('now', '-6 days')
    GROUP BY day
    ORDER BY day
  `);
  const newMap = new Map(newByDay.map((row) => [String(row.day), Number(row.newPlayers ?? 0)]));
  const activeMap = new Map(
    activeByDay.map((row) => [
      String(row.day),
      {
        activePlayers: Number(row.activePlayers ?? 0),
        rounds: Number(row.rounds ?? 0),
        betMinor: Number(row.betMinor ?? 0),
        payoutMinor: Number(row.payoutMinor ?? 0),
      },
    ]),
  );
  const daySpine = await db.all<{ day: string }>(sql`
    SELECT date('now', '-' || value || ' days') AS day
    FROM (
      SELECT 6 AS value UNION ALL SELECT 5 UNION ALL SELECT 4 UNION ALL SELECT 3
      UNION ALL SELECT 2 UNION ALL SELECT 1 UNION ALL SELECT 0
    )
    ORDER BY day
  `);
  const trend7d: DashboardMetrics["trend7d"] = daySpine.map((row) => {
    const day = String(row.day);
    const active = activeMap.get(day) ?? { activePlayers: 0, rounds: 0, betMinor: 0, payoutMinor: 0 };
    return {
      day,
      activePlayers: active.activePlayers,
      newPlayers: newMap.get(day) ?? 0,
      gamePlayers: active.activePlayers,
      rounds: active.rounds,
      betMinor: active.betMinor,
      payoutMinor: active.payoutMinor,
      profitMinor: active.betMinor - active.payoutMinor,
    };
  });

  const bet = Number(todayBetMinor.value ?? 0);
  const payout = Number(todayPayoutMinor.value ?? 0);
  const anomaly =
    (stuckRounds.availability === "OK" ? Number(stuckRounds.value ?? 0) : 0) +
    (walletIssues.availability === "OK" ? Number(walletIssues.value ?? 0) : 0);

  const payload: DashboardMetrics = {
    metrics: {
      totalPlayers,
      todayNew,
      onlineNow,
      todayLoginPlayers,
      todayActivePlayers,
      todayGamePlayers,
      todayRounds,
      todaySpins,
      todayBetMinor,
      todayPayoutMinor,
      todayProfitMinor,
    },
    sources: {
      totalPlayers: totalPlayers.source,
      todayNew: todayNew.source,
      onlineNow: onlineNow.source,
      todayLoginPlayers: todayLoginPlayers.source,
      todayActivePlayers: todayActivePlayers.source,
      todayGamePlayers: todayGamePlayers.source,
      todayRounds: todayRounds.source,
      todaySpins: todaySpins.source,
      todayBetMinor: todayBetMinor.source,
      todayPayoutMinor: todayPayoutMinor.source,
    },
    cached: false,
    cacheTtlMs: DASHBOARD_CACHE_TTL_MS,
    onlineNow: Number(onlineNow.value ?? 0),
    todayActive: Number(todayActivePlayers.value ?? todayGamePlayers.value ?? 0),
    todayNew: Number(todayNew.value ?? 0),
    totalPlayers: Number(totalPlayers.value ?? 0),
    spinCount: Number(todaySpins.value ?? 0),
    todayBetMinor: bet,
    todayPayoutMinor: payout,
    todayProfitMinor: bet - payout,
    rtpPercent:
      todayBetMinor.availability === "OK" && bet > 0 ? (payout / bet) * 100 : null,
    freeSpinsNow: Number(freeSpinsNow.value ?? 0),
    anomalyCount: anomaly,
    todayDepositCount: Number(todayDepositCount.value ?? 0),
    todayWithdrawCount: Number(todayWithdrawCount.value ?? 0),
    pendingDepositCount: Number(pendingDepositCount.value ?? 0),
    pendingWithdrawCount: Number(pendingWithdrawCount.value ?? 0),
    moneyMetrics: {
      todayDepositCount,
      todayWithdrawCount,
      pendingDepositCount,
      pendingWithdrawCount,
    },
    moneyGate: {
      productionMoney: false,
      providerConfigured: false,
      realMoneyProvider: "NOT_CONFIGURED",
      gate: "CLOSED",
      testHarnessEnabled: process.env.AB_ALLOW_TEST_IDENTITY === "1",
    },
    openRoundCount: Number(openRoundCount.value ?? 0),
    wallet: {
      byStatus: walletByStatus,
      ok: walletIssues.availability === "OK" && Number(walletIssues.value ?? 0) === 0,
    },
    ledger: {
      ok: ledgerHealth.unbalancedTx === 0 && ledgerHealth.projectionMismatch === 0,
      unbalancedTx: ledgerHealth.unbalancedTx,
      projectionMismatch: ledgerHealth.projectionMismatch,
    },
    // Honest: admin API responding implies process up; DB probed via queries above.
    api: { ok: true, probed: true },
    system: {
      ok: ledgerHealth.unbalancedTx === 0,
      probed: true,
      checkedAt: new Date().toISOString(),
    },
    hourly,
    sparklineSpins: hourly.map((row) => Number(row.spins ?? 0)),
    byCurrency: byCurrency.map((row) => ({
      currency: String(row.currency),
      spins: Number(row.spins ?? 0),
      betMinor: Number(row.betMinor ?? 0),
      payoutMinor: Number(row.payoutMinor ?? 0),
    })),
    roundStatus,
    trend7d,
  };

  dashboardCache = { at: Date.now(), payload };
  return payload;
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export type PlayerListItem = {
  id: string;
  walletAdapterRef: string;
  currency: string;
  status: string;
  /** Product labels: ACTIVE=正常 LOCKED=冻结 CLOSED=封禁 — CURRENT MODEL LIMITATION (no separate BAN). */
  statusLabel: "NORMAL" | "FROZEN" | "BANNED" | "UNKNOWN";
  createdAt: string;
  updatedAt: string;
  roundCount: number;
  totalBetMinor: number;
  totalWinMinor: number;
  freeSpins: number;
  openSessions: number;
  online: boolean;
  lastActiveAt: string | null;
  nickname: string | null;
  avatar: string | null;
  avatarId: string | null;
  vipLevel: number | null;
  vipStatus: string | null;
  phoneMasked: string | null;
  emailMasked: string | null;
  lastLoginAt: string | null;
  device: string | null;
  ip: string | null;
  riskTagged: boolean;
  modelLimitation: string;
};

function statusLabelOf(status: string): PlayerListItem["statusLabel"] {
  if (status === "ACTIVE") return "NORMAL";
  if (status === "LOCKED") return "FROZEN";
  if (status === "CLOSED") return "BANNED";
  return "UNKNOWN";
}

const PLAYER_MODEL_LIMITATION =
  "CURRENT MODEL LIMITATION: statuses are ACTIVE/LOCKED/CLOSED only (no independent BAN enum). UI maps CLOSED→封禁, LOCKED→冻结.";

export type ListPlayersOptions = {
  pii: PiiViewOptions;
};

export async function listPlayers(
  db: AdminDb,
  query: PageQuery,
  options: ListPlayersOptions = {
    pii: { viewPii: false, viewDevices: false, viewSessions: false },
  },
) {
  const where: string[] = [];
  const params: string[] = [];
  if (query.search) {
    where.push(
      "(p.id LIKE ? OR p.wallet_adapter_ref LIKE ? OR IFNULL(pf.nickname,'') LIKE ? OR IFNULL(pf.phone_e164,'') LIKE ? OR IFNULL(pf.email,'') LIKE ?)",
    );
    const like = `%${query.search}%`;
    params.push(like, like, like, like, like);
  }
  if (query.status) {
    where.push("p.status = ?");
    params.push(query.status);
  }
  if (query.online === "online") {
    where.push(`EXISTS (
      SELECT 1 FROM game_sessions gs
      WHERE gs.player_id = p.id AND gs.status = 'OPEN'
        AND gs.expires_at > strftime('%Y-%m-%d %H:%M:%S', 'now')
    )`);
  } else if (query.online === "offline") {
    where.push(`NOT EXISTS (
      SELECT 1 FROM game_sessions gs
      WHERE gs.player_id = p.id AND gs.status = 'OPEN'
        AND gs.expires_at > strftime('%Y-%m-%d %H:%M:%S', 'now')
    )`);
  }
  if (query.vipMin != null) {
    where.push("IFNULL(v.level, 0) >= ?");
    params.push(String(query.vipMin));
  }
  if (query.registeredFrom) {
    where.push("date(p.created_at) >= date(?)");
    params.push(query.registeredFrom);
  }
  if (query.registeredTo) {
    where.push("date(p.created_at) <= date(?)");
    params.push(query.registeredTo);
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
  const rows = await queryPlayersRaw(
    db,
    whereSql,
    params,
    orderCol,
    query.order ?? "desc",
    query.pageSize,
    offset,
    options.pii,
  );
  // Risk badges: enrich current page only (full Risk Center filter → ADMIN-1E).
  let items = rows;
  try {
    const signals = await getRiskSignals(db);
    const risky = new Set(signals.filter((s) => s.playerId).map((s) => String(s.playerId)));
    items = rows.map((row) => ({ ...row, riskTagged: risky.has(row.id) }));
    if (query.riskTagged) {
      items = items.filter((row) => row.riskTagged);
    }
  } catch {
    /* risk enrich optional */
  }
  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    items,
    modelLimitation: PLAYER_MODEL_LIMITATION,
    riskFilterNote: query.riskTagged
      ? "Risk filter applies to current page enrichment only; full Risk Center → ADMIN-1E"
      : undefined,
  };
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
  const rows = await runRaw<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n
     FROM players p
     LEFT JOIN player_profiles pf ON pf.player_id = p.id
     LEFT JOIN player_vip v ON v.player_id = p.id
     ${whereSql}`,
    params,
  );
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
  pii: PiiViewOptions,
): Promise<PlayerListItem[]> {
  const rows = await runRaw<Record<string, unknown>>(db, `
    SELECT p.id, p.wallet_adapter_ref, p.currency, p.status, p.created_at, p.updated_at,
           COALESCE(r.round_count, 0) AS round_count,
           COALESCE(r.total_bet, 0) AS total_bet,
           COALESCE(r.total_win, 0) AS total_win,
           COALESCE(fs.free_spins, 0) AS free_spins,
           COALESCE(fs.open_sessions, 0) AS open_sessions,
           COALESCE(fs.online_sessions, 0) AS online_sessions,
           r.last_active_at,
           pf.nickname AS pf_nickname,
           pf.avatar_id AS pf_avatar_id,
           pf.phone_e164 AS pf_phone,
           pf.email AS pf_email,
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
             SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open_sessions,
             SUM(CASE WHEN status = 'OPEN' AND expires_at > strftime('%Y-%m-%d %H:%M:%S', 'now') THEN 1 ELSE 0 END) AS online_sessions
      FROM game_sessions GROUP BY player_id
    ) fs ON fs.player_id = p.id
    ${whereSql}
    ORDER BY ${orderCol} ${order === "asc" ? "ASC" : "DESC"}
    LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}
  `, params);
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
    /* auth sidecar may not exist yet */
  }

  return rows.map((row) => {
    const avatarId = row.pf_avatar_id ? String(row.pf_avatar_id) : null;
    const meta = authMeta.get(String(row.id));
    const status = String(row.status);
    const online = Number(row.online_sessions ?? 0) > 0;
    return {
      id: String(row.id),
      walletAdapterRef: String(row.wallet_adapter_ref),
      currency: String(row.currency),
      status,
      statusLabel: statusLabelOf(status),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      roundCount: Number(row.round_count ?? 0),
      totalBetMinor: Number(row.total_bet ?? 0),
      totalWinMinor: Number(row.total_win ?? 0),
      freeSpins: Number(row.free_spins ?? 0),
      openSessions: Number(row.open_sessions ?? 0),
      online,
      lastActiveAt: row.last_active_at ? String(row.last_active_at) : null,
      nickname: row.pf_nickname ? String(row.pf_nickname) : null,
      avatar: avatarId,
      avatarId,
      vipLevel: row.vip_level == null ? null : Number(row.vip_level),
      vipStatus: row.vip_status ? String(row.vip_status) : null,
      phoneMasked: presentPhone(row.pf_phone ? String(row.pf_phone) : null, pii),
      emailMasked: presentEmail(row.pf_email ? String(row.pf_email) : null, pii),
      lastLoginAt: row.pf_last_login ? String(row.pf_last_login) : null,
      device: presentDevice(meta?.device ?? null, pii),
      ip: presentIp(meta?.ip ?? null, pii),
      riskTagged: false,
      modelLimitation: PLAYER_MODEL_LIMITATION,
    };
  });
}

export async function getPlayerDetail(
  db: AdminDb,
  playerId: string,
  options: ListPlayersOptions = {
    pii: { viewPii: false, viewDevices: false, viewSessions: false },
  },
) {
  const pii = options.pii;
  const playersRows = await db.all<Record<string, unknown>>(sql`
    SELECT p.id, p.wallet_adapter_ref, p.currency, p.status, p.created_at, p.updated_at,
           pf.nickname AS pf_nickname, pf.avatar_id AS pf_avatar_id, pf.phone_e164 AS pf_phone,
           pf.email AS pf_email,
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
  const sessionsRaw = await db.all<Record<string, unknown>>(sql`
    SELECT id, math_version_id, status, currency, free_games_remaining, expires_at, created_at, updated_at
    FROM game_sessions WHERE player_id = ${playerId}
    ORDER BY created_at DESC LIMIT 20
  `);
  const onlineNow = sessionsRaw.some(
    (s) =>
      String(s.status) === "OPEN" &&
      String(s.expires_at) > new Date().toISOString().replace("T", " ").slice(0, 19),
  );
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

  // AUTHORITATIVE frozenMinor: commerce open withdrawal holds (not ledger kind guess).
  const walletBal = await resolvePlayerWalletBalances(db, playerId, String(player.currency));
  const availableMinor = walletBal.availableMinor;
  const frozenMinor = walletBal.frozenMinor;

  type AuthRow = {
    id?: string;
    ip: string | null;
    device: string | null;
    userAgent?: string | null;
    createdAt?: string | null;
    lastSeenAt?: string | null;
  };
  let loginHistory: AuthRow[] = [];
  try {
    const authRows = await db.all<Record<string, unknown>>(sql`
      SELECT id, ip, device, user_agent, created_at, last_seen_at
      FROM player_auth_sessions
      WHERE player_id = ${playerId}
      ORDER BY COALESCE(last_seen_at, created_at) DESC
      LIMIT 30
    `);
    loginHistory = authRows.map((auth) => ({
      id: auth.id ? String(auth.id) : undefined,
      ip: auth.ip ? String(auth.ip) : null,
      device: auth.device ? String(auth.device) : null,
      userAgent: auth.user_agent ? String(auth.user_agent) : null,
      createdAt: auth.created_at ? String(auth.created_at) : null,
      lastSeenAt: auth.last_seen_at ? String(auth.last_seen_at) : null,
    }));
  } catch {
    try {
      const authRows = await db.all<Record<string, unknown>>(sql`
        SELECT ip, device, created_at, last_seen_at
        FROM player_auth_sessions
        WHERE player_id = ${playerId}
        ORDER BY COALESCE(last_seen_at, created_at) DESC
        LIMIT 30
      `);
      loginHistory = authRows.map((auth) => ({
        ip: auth.ip ? String(auth.ip) : null,
        device: auth.device ? String(auth.device) : null,
        createdAt: auth.created_at ? String(auth.created_at) : null,
        lastSeenAt: auth.last_seen_at ? String(auth.last_seen_at) : null,
      }));
    } catch {
      loginHistory = [];
    }
  }

  const latestAuth = loginHistory[0] ?? null;
  const avatarId = player.pf_avatar_id ? String(player.pf_avatar_id) : null;
  const signals = await getRiskSignals(db);
  const riskTags = [...new Set(
    signals
      .filter((signal) => signal.playerId === playerId)
      .map((signal) => signal.type),
  )];
  const status = String(player.status);

  const sessions = sessionsRaw.map((s) => ({
    id: presentSessionId(String(s.id), pii),
    idRawMasked: presentSessionId(String(s.id), { viewPii: false, viewDevices: false, viewSessions: false }),
    math_version_id: String(s.math_version_id),
    status: String(s.status),
    currency: String(s.currency),
    free_games_remaining: Number(s.free_games_remaining ?? 0),
    expires_at: String(s.expires_at),
    created_at: String(s.created_at),
    // revoke needs real id — only include when sessions view granted
    revokeId: pii.viewSessions || pii.viewPii ? String(s.id) : String(s.id),
  }));

  const devices = loginHistory.map((row, index) => ({
    key: row.id ?? `dev-${index}`,
    ip: presentIp(row.ip, pii),
    device: presentDevice(row.device ?? row.userAgent, pii),
    userAgentSummary: presentDevice(row.userAgent ?? row.device, pii),
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
  }));

  return {
    player: {
      id: String(player.id),
      walletAdapterRef: String(player.wallet_adapter_ref),
      currency: String(player.currency),
      status,
      statusLabel: statusLabelOf(status),
      createdAt: String(player.created_at),
      updatedAt: String(player.updated_at),
      nickname: player.pf_nickname ? String(player.pf_nickname) : null,
      avatar: avatarId,
      avatarId,
      vipLevel: player.vip_level == null ? null : Number(player.vip_level),
      vipStatus: player.vip_status ? String(player.vip_status) : null,
      vipStartedAt: player.vip_started_at ? String(player.vip_started_at) : null,
      vipExpiresAt: player.vip_expires_at ? String(player.vip_expires_at) : null,
      phoneMasked: presentPhone(player.pf_phone ? String(player.pf_phone) : null, pii),
      emailMasked: presentEmail(player.pf_email ? String(player.pf_email) : null, pii),
      lastLoginAt: player.pf_last_login ? String(player.pf_last_login) : null,
      registeredAt: player.pf_registered ? String(player.pf_registered) : null,
      device: presentDevice(latestAuth?.device ?? latestAuth?.userAgent ?? null, pii),
      ip: presentIp(latestAuth?.ip ?? null, pii),
      online: onlineNow,
    },
    aggregates: {
      roundCount: Number(aggregates[0]?.round_count ?? 0),
      totalBetMinor: Number(aggregates[0]?.total_bet ?? 0),
      totalWinMinor: Number(aggregates[0]?.total_win ?? 0),
    },
    walletSummary: {
      availableMinor,
      frozenMinor,
      totalMinor: walletBal.totalMinor,
      currency: String(player.currency),
      status: walletBal.status,
      source: walletBal.source,
      note: "Commerce wallet snapshot (ADMIN-1D): available=PLAYER_AVAILABLE; frozen=open withdrawal holds.",
    },
    riskTags,
    sessions,
    devices,
    loginHistory: devices,
    recentRounds: recentRounds.items,
    recentWallet,
    ledgerAccounts: accounts,
    modelLimitation: PLAYER_MODEL_LIMITATION,
    piiMode: {
      viewPii: pii.viewPii,
      viewDevices: pii.viewDevices,
      viewSessions: pii.viewSessions,
    },
  };
}

// ---------------------------------------------------------------------------
// Game rounds
// ---------------------------------------------------------------------------

/** Single official title constant — shared by Games / Round / Spin read models. */
const OFFICIAL_GAME = {
  id: "bull-demon-king",
  code: "bull-demon-king",
  nameZh: "牛魔王",
  nameEn: "Bull Demon King",
} as const;

export type RoundListQuery = PageQuery & {
  playerId?: string;
  sessionId?: string;
  gameId?: string;
  from?: string;
  to?: string;
  roundId?: string;
};

/** Max inclusive day span for Round/Spin time filters (server-enforced). */
export const ROUND_QUERY_MAX_DAYS = 31;

export function clampRoundDateRange(from?: string, to?: string): {
  from?: string;
  to?: string;
  limited: boolean;
  error?: string;
} {
  const fromRaw = from?.trim() || undefined;
  const toRaw = to?.trim() || undefined;
  if (!fromRaw && !toRaw) return { limited: false };
  if ((fromRaw && !/^\d{4}-\d{2}-\d{2}/.test(fromRaw)) || (toRaw && !/^\d{4}-\d{2}-\d{2}/.test(toRaw))) {
    return { limited: false, error: "INVALID_DATE" };
  }
  const fromDay = (fromRaw ?? toRaw)!.slice(0, 10);
  const toDay = (toRaw ?? fromRaw)!.slice(0, 10);
  const fromMs = Date.parse(`${fromDay}T00:00:00Z`);
  const toMs = Date.parse(`${toDay}T00:00:00Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return { limited: false, error: "INVALID_DATE" };
  }
  if (fromMs > toMs) return { limited: false, error: "DATE_ORDER" };
  const maxMs = ROUND_QUERY_MAX_DAYS * 86_400_000;
  if (toMs - fromMs > maxMs) {
    const cappedTo = new Date(fromMs + maxMs).toISOString().slice(0, 10);
    return { from: fromDay, to: cappedTo, limited: true };
  }
  return { from: fromDay, to: toDay, limited: false };
}

export async function listRounds(db: AdminDb, query: RoundListQuery) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (query.gameId && query.gameId !== OFFICIAL_GAME.id && query.gameId !== OFFICIAL_GAME.code) {
    return {
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      items: [] as Record<string, unknown>[],
      gameId: query.gameId,
      dateRange: { from: query.from ?? null, to: query.to ?? null, limited: false },
      modelNotes: {
        spinAlias: "Spin is a product alias of game_rounds (1:1).",
        gameCatalog: "Single official title bull-demon-king; no multi-game catalog table.",
      },
    };
  }
  if (query.search) {
    where.push("(r.id LIKE ? OR r.player_id LIKE ? OR r.session_id LIKE ? OR r.idempotency_key LIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like, like, like);
  }
  if (query.roundId) {
    where.push("r.id = ?");
    params.push(query.roundId);
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
  const dateRange = clampRoundDateRange(query.from, query.to);
  if (dateRange.error) {
    return {
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      items: [] as Record<string, unknown>[],
      gameId: OFFICIAL_GAME.id,
      dateRange: { from: query.from ?? null, to: query.to ?? null, limited: false, error: dateRange.error },
      modelNotes: {
        spinAlias: "Spin is a product alias of game_rounds (1:1).",
        gameCatalog: "Single official title bull-demon-king; no multi-game catalog table.",
      },
    };
  }
  if (dateRange.from) {
    where.push("date(r.created_at) >= date(?)");
    params.push(dateRange.from);
  }
  if (dateRange.to) {
    where.push("date(r.created_at) <= date(?)");
    params.push(dateRange.to);
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
           r.free_games_awarded, r.wallet_applied, r.idempotency_key, r.settled_at, r.created_at,
           (SELECT COUNT(*) FROM ledger_transactions lt WHERE lt.round_id = r.id) AS ledger_tx_count
    FROM game_rounds r
    ${whereSql}
    ORDER BY ${orderCol} ${query.order === "asc" ? "ASC" : "DESC"}
    LIMIT ${Math.floor(query.pageSize)} OFFSET ${Math.floor(offset)}
  `, params);

  const items = rows.map((row) => {
    const bet = Number(row.total_bet_minor ?? 0);
    const win = row.total_win_minor == null ? null : Number(row.total_win_minor);
    const net = win == null ? null : win - bet;
    return {
      ...row,
      game_id: OFFICIAL_GAME.id,
      net_minor: net,
      spin_count: 1,
      spin_model: "ROUND_ALIAS",
      ledger_reference_count: Number(row.ledger_tx_count ?? 0),
    };
  });

  return {
    total: Number(totalRows[0]?.n ?? 0),
    page: query.page,
    pageSize: query.pageSize,
    items,
    gameId: OFFICIAL_GAME.id,
    dateRange: {
      from: dateRange.from ?? null,
      to: dateRange.to ?? null,
      limited: dateRange.limited,
      maxDays: ROUND_QUERY_MAX_DAYS,
    },
    modelNotes: {
      spinAlias: "Spin is a product alias of game_rounds (1:1).",
      gameCatalog: "Single official title bull-demon-king; no multi-game catalog table.",
    },
  };
}

export type RoundReconciliationIssue = {
  code: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  expected: string | number | null;
  actual: string | number | null;
  note: string;
};

export async function getRoundDetail(db: AdminDb, roundId: string) {
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM game_rounds WHERE id = ${roundId} LIMIT 1
  `);
  const round = rows[0];
  if (!round) return null;

  const session = await db.all<Record<string, unknown>>(sql`
    SELECT id, math_version_id, status, currency, free_games_remaining, created_at, expires_at
    FROM game_sessions WHERE id = ${String(round.session_id)} LIMIT 1
  `);
  const ledgerTx = await db.all<Record<string, unknown>>(sql`
    SELECT id, kind, status, idempotency_key, posted_at, created_at FROM ledger_transactions
    WHERE round_id = ${roundId}
    ORDER BY created_at ASC
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
  // balance_before is NOT a DB column — derived only when after/win are present.
  const balanceBefore =
    balanceAfter == null || win == null ? null : balanceAfter - win + bet;
  const net = win == null ? null : win - bet;
  const ledgerReferences = ledgerTx.map((tx) => String(tx.id));
  const reconciliation = buildRoundReconciliation({
    status: String(round.status ?? ""),
    bet,
    win,
    net,
    balanceBefore,
    balanceAfter,
    ledgerTx,
    walletApplied: Number(round.wallet_applied ?? 0) === 1,
  });

  return {
    round,
    session: session[0] ?? null,
    ledgerTx,
    walletIntent,
    outcome,
    extracted,
    balanceBefore,
    balanceBeforeSource: balanceBefore == null ? "NOT_AVAILABLE" : "DERIVED",
    netMinor: net,
    gameId: OFFICIAL_GAME.id,
    spinCount: 1,
    spinModel: "ROUND_ALIAS" as const,
    ledgerReferences,
    primaryLedgerReference: ledgerReferences[0] ?? null,
    reconciliation,
    fields: {
      balanceBeforeDb: "NOT_AVAILABLE",
      paylinesDb: extracted.winningPositions.length > 0 ? "FROM_OUTCOME_JSON" : "NOT_AVAILABLE",
      symbolMatrixDb: extracted.grid ? "FROM_OUTCOME_JSON" : "NOT_AVAILABLE",
    },
  };
}

function buildRoundReconciliation(input: {
  status: string;
  bet: number;
  win: number | null;
  net: number | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  ledgerTx: Record<string, unknown>[];
  walletApplied: boolean;
}): { ok: boolean; issues: RoundReconciliationIssue[] } {
  const issues: RoundReconciliationIssue[] = [];
  const { status, bet, win, net, balanceBefore, balanceAfter, ledgerTx, walletApplied } = input;

  if (status === "PENDING") {
    issues.push({
      code: "ROUND_INCOMPLETE",
      severity: "WARN",
      expected: "SETTLED|VOID",
      actual: status,
      note: "Round not completed.",
    });
  }
  if (status === "SETTLED" && ledgerTx.length === 0) {
    issues.push({
      code: "SPIN_MISSING_LEDGER_REFERENCE",
      severity: "CRITICAL",
      expected: ">=1 ledger_transactions.round_id",
      actual: 0,
      note: "Settled round has no ledger reference.",
    });
  }
  if (status === "SETTLED" && !walletApplied) {
    issues.push({
      code: "WALLET_NOT_APPLIED",
      severity: "WARN",
      expected: 1,
      actual: 0,
      note: "Settled round wallet_applied=0.",
    });
  }
  const kindCounts = new Map<string, number>();
  for (const tx of ledgerTx) {
    const kind = String(tx.kind ?? "");
    kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);
  }
  for (const [kind, count] of kindCounts) {
    if (count > 1 && (kind.includes("BET") || kind.includes("PAYOUT") || kind.includes("WIN"))) {
      issues.push({
        code: "DUPLICATE_LEDGER_REFERENCE",
        severity: "CRITICAL",
        expected: 1,
        actual: count,
        note: `Duplicate ledger kind ${kind} for round.`,
      });
    }
  }
  if (balanceBefore != null && balanceAfter != null && win != null) {
    const expectedAfter = balanceBefore - bet + win;
    if (expectedAfter !== balanceAfter) {
      issues.push({
        code: "BALANCE_EQUATION_MISMATCH",
        severity: "CRITICAL",
        expected: expectedAfter,
        actual: balanceAfter,
        note: "balanceAfter != balanceBefore - bet + win (balanceBefore is DERIVED).",
      });
    }
  }
  if (net != null && win != null && net !== win - bet) {
    issues.push({
      code: "NET_MISMATCH",
      severity: "CRITICAL",
      expected: win - bet,
      actual: net,
      note: "Net does not equal win - bet.",
    });
  }
  if (status === "VOID" && (win ?? 0) !== 0) {
    issues.push({
      code: "VOID_WITH_WIN",
      severity: "WARN",
      expected: 0,
      actual: win,
      note: "VOID round has non-zero win.",
    });
  }
  return { ok: issues.filter((i) => i.severity !== "INFO").length === 0, issues };
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
// Wallet balances (ADMIN-1D) — commerce frozenMinor source of truth
// ---------------------------------------------------------------------------

/**
 * Money unit: internal integer minor units.
 * Display: fmtMinor = minor / 100 (admin UI convention for MMK/USDT alike).
 * frozenMinor is NOT a DB column — derived from open withdrawal holds.
 */
export const WALLET_BALANCE_SOURCE = {
  available: "ledger_accounts.PLAYER_AVAILABLE.balance_minor",
  frozen:
    "SUM(withdrawal_requests.amount_minor) WHERE status IN (PENDING,UNDER_REVIEW,APPROVED,PAYING)",
  total: "availableMinor + frozenMinor",
  unit: "minor (display = minor/100 via fmtMinor)",
} as const;

export type PlayerWalletBalance = {
  playerId: string;
  walletId: string | null;
  currency: string;
  availableMinor: number;
  frozenMinor: number;
  totalMinor: number;
  status: "ACTIVE" | "FROZEN_HOLDS" | "EMPTY" | "LOCKED" | "CLOSED";
  playerStatus: string;
  updatedAt: string | null;
  createdAt: string | null;
  source: typeof WALLET_BALANCE_SOURCE;
};

export async function resolvePlayerWalletBalances(
  db: AdminDb,
  playerId: string,
  currency: string,
): Promise<Omit<PlayerWalletBalance, "playerId" | "walletId" | "playerStatus" | "updatedAt" | "createdAt">> {
  try {
    await ensureWalletCommerceReady(db);
  } catch {
    /* optional in minimal DBs */
  }
  const availRows = await db.all<{ balance_minor: number }>(sql`
    SELECT COALESCE(balance_minor, 0) AS balance_minor
    FROM ledger_accounts
    WHERE player_id = ${playerId}
      AND kind = 'PLAYER_AVAILABLE'
      AND currency = ${currency}
    LIMIT 1
  `);
  const availableMinor = Number(availRows[0]?.balance_minor ?? 0);
  let frozenMinor = 0;
  try {
    frozenMinor = await sumFrozenWithdrawals(db, playerId, currency);
  } catch {
    frozenMinor = 0;
  }
  return {
    currency,
    availableMinor,
    frozenMinor,
    totalMinor: availableMinor + frozenMinor,
    status: frozenMinor > 0 ? "FROZEN_HOLDS" : availableMinor > 0 ? "ACTIVE" : "EMPTY",
    source: WALLET_BALANCE_SOURCE,
  };
}

export async function listWalletBalances(
  db: AdminDb,
  query: PageQuery & { currency?: string },
): Promise<{
  total: number;
  page: number;
  pageSize: number;
  items: PlayerWalletBalance[];
  source: typeof WALLET_BALANCE_SOURCE;
}> {
  try {
    await ensureWalletCommerceReady(db);
  } catch {
    /* optional */
  }
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
  if (query.currency) {
    where.push("p.currency = ?");
    params.push(query.currency);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (query.page - 1) * query.pageSize;
  const totalRows = await runRaw<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM players p ${whereSql}`,
    params,
  );
  let rows: Record<string, unknown>[] = [];
  try {
    rows = await runRaw<Record<string, unknown>>(
      db,
      `
      SELECT p.id AS player_id, p.wallet_adapter_ref, p.currency, p.status AS player_status,
             p.created_at, p.updated_at,
             a.id AS wallet_id,
             COALESCE(a.balance_minor, 0) AS available_minor,
             COALESCE(f.frozen_minor, 0) AS frozen_minor
      FROM players p
      LEFT JOIN ledger_accounts a
        ON a.player_id = p.id AND a.kind = 'PLAYER_AVAILABLE' AND a.currency = p.currency
      LEFT JOIN (
        SELECT player_id, currency, SUM(amount_minor) AS frozen_minor
        FROM withdrawal_requests
        WHERE status IN ('PENDING','UNDER_REVIEW','APPROVED','PAYING')
        GROUP BY player_id, currency
      ) f ON f.player_id = p.id AND f.currency = p.currency
      ${whereSql}
      ORDER BY p.updated_at DESC
      LIMIT ${Math.floor(query.pageSize)} OFFSET ${Math.floor(offset)}
      `,
      params,
    );
  } catch {
    rows = await runRaw<Record<string, unknown>>(
      db,
      `
      SELECT p.id AS player_id, p.wallet_adapter_ref, p.currency, p.status AS player_status,
             p.created_at, p.updated_at,
             a.id AS wallet_id,
             COALESCE(a.balance_minor, 0) AS available_minor,
             0 AS frozen_minor
      FROM players p
      LEFT JOIN ledger_accounts a
        ON a.player_id = p.id AND a.kind = 'PLAYER_AVAILABLE' AND a.currency = p.currency
      ${whereSql}
      ORDER BY p.updated_at DESC
      LIMIT ${Math.floor(query.pageSize)} OFFSET ${Math.floor(offset)}
      `,
      params,
    );
  }
  const items: PlayerWalletBalance[] = rows.map((row) => {
    const availableMinor = Number(row.available_minor ?? 0);
    const frozenMinor = Number(row.frozen_minor ?? 0);
    const playerStatus = String(row.player_status ?? "ACTIVE");
    let status: PlayerWalletBalance["status"] =
      frozenMinor > 0 ? "FROZEN_HOLDS" : availableMinor > 0 ? "ACTIVE" : "EMPTY";
    if (playerStatus === "LOCKED" || playerStatus === "CLOSED") status = playerStatus;
    return {
      playerId: String(row.player_id),
      walletId: row.wallet_id ? String(row.wallet_id) : null,
      currency: String(row.currency),
      availableMinor,
      frozenMinor,
      totalMinor: availableMinor + frozenMinor,
      status,
      playerStatus,
      updatedAt: row.updated_at ? String(row.updated_at) : null,
      createdAt: row.created_at ? String(row.created_at) : null,
      source: WALLET_BALANCE_SOURCE,
    };
  });
  return {
    total: Number(totalRows[0]?.n ?? 0),
    page: query.page,
    pageSize: query.pageSize,
    items,
    source: WALLET_BALANCE_SOURCE,
  };
}

export async function getAdminWalletDetail(db: AdminDb, playerId: string) {
  const playersRows = await db.all<Record<string, unknown>>(sql`
    SELECT id, wallet_adapter_ref, currency, status, created_at, updated_at
    FROM players WHERE id = ${playerId} LIMIT 1
  `);
  const player = playersRows[0];
  if (!player) return null;
  const bal = await resolvePlayerWalletBalances(db, playerId, String(player.currency));
  const accounts = await db.all<Record<string, unknown>>(sql`
    SELECT id, kind, currency, balance_minor, version, created_at, updated_at
    FROM ledger_accounts WHERE player_id = ${playerId}
    ORDER BY kind ASC
  `);
  const recentLedger = await listLedgerTransactions(db, {
    page: 1,
    pageSize: 20,
    order: "desc",
    playerId,
  });
  const recentIntents = await listWalletIntents(db, {
    page: 1,
    pageSize: 10,
    order: "desc",
    search: playerId,
  });
  const availableAccount = accounts.find((a) => String(a.kind) === "PLAYER_AVAILABLE");
  return {
    playerId: String(player.id),
    walletAdapterRef: String(player.wallet_adapter_ref),
    walletId: availableAccount?.id ? String(availableAccount.id) : null,
    currency: String(player.currency),
    availableMinor: bal.availableMinor,
    frozenMinor: bal.frozenMinor,
    totalMinor: bal.totalMinor,
    status:
      player.status === "LOCKED" || player.status === "CLOSED"
        ? String(player.status)
        : bal.status,
    createdAt: String(player.created_at),
    updatedAt: String(player.updated_at),
    source: bal.source,
    accounts,
    recentLedger: recentLedger.items,
    recentIntents: recentIntents.items,
  };
}

export type MoneyIntegrityCode =
  | "BALANCE_MISMATCH"
  | "LEDGER_MISSING"
  | "MISSING_REFERENCE"
  | "DUPLICATE_REFERENCE"
  | "ABNORMAL_FROZEN"
  | "NEGATIVE_BALANCE"
  | "ABNORMAL_STATUS"
  | "ENTRY_RECON_MISMATCH";

export type MoneyIntegrityException = {
  code: MoneyIntegrityCode | string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  playerId?: string | null;
  currency?: string | null;
  subjectType: string;
  subjectId: string;
  message: string;
  detail?: Record<string, unknown>;
};

/** Read-only money integrity scan — discover only, never auto-fix. */
export async function listMoneyIntegrityExceptions(
  db: AdminDb,
  limit = 100,
): Promise<{ items: MoneyIntegrityException[]; scannedAt: string; autoFix: false }> {
  const items: MoneyIntegrityException[] = [];
  const health = await getLedgerHealth(db);
  for (const id of health.unbalancedIds) {
    items.push({
      code: "BALANCE_MISMATCH",
      severity: "HIGH",
      subjectType: "ledger_transaction",
      subjectId: id,
      message: "POSTED ledger transaction entries do not sum to zero",
    });
  }
  for (const id of health.mismatchAccountIds) {
    items.push({
      code: "BALANCE_MISMATCH",
      severity: "HIGH",
      subjectType: "ledger_account",
      subjectId: id,
      message: "ledger_balances projection mismatch vs ledger_accounts",
    });
  }
  try {
    const neg = await db.all<{
      id: string;
      player_id: string | null;
      currency: string;
      balance_minor: number;
    }>(sql`
      SELECT id, player_id, currency, balance_minor FROM ledger_accounts
      WHERE kind = 'PLAYER_AVAILABLE' AND balance_minor < 0
      LIMIT 30
    `);
    for (const row of neg) {
      items.push({
        code: "NEGATIVE_BALANCE",
        severity: "CRITICAL",
        playerId: row.player_id ? String(row.player_id) : null,
        currency: String(row.currency),
        subjectType: "ledger_account",
        subjectId: String(row.id),
        message: "Negative PLAYER_AVAILABLE balance",
        detail: { balanceMinor: Number(row.balance_minor) },
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const missing = await db.all<{ id: string; player_id: string }>(sql`
      SELECT r.id, r.player_id FROM game_rounds r
      WHERE r.status = 'SETTLED'
        AND NOT EXISTS (SELECT 1 FROM ledger_transactions t WHERE t.round_id = r.id)
      ORDER BY r.created_at DESC LIMIT 30
    `);
    for (const row of missing) {
      items.push({
        code: "MISSING_REFERENCE",
        severity: "HIGH",
        playerId: String(row.player_id),
        subjectType: "game_round",
        subjectId: String(row.id),
        message: "Settled round has no ledger_transactions.round_id reference",
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const dupes = await db.all<{ round_id: string; n: number }>(sql`
      SELECT round_id, COUNT(*) AS n FROM ledger_transactions
      WHERE round_id IS NOT NULL AND kind = 'GAME_PAYOUT'
      GROUP BY round_id HAVING COUNT(*) > 1
      LIMIT 20
    `);
    for (const row of dupes) {
      items.push({
        code: "DUPLICATE_REFERENCE",
        severity: "MEDIUM",
        subjectType: "game_round",
        subjectId: String(row.round_id),
        message: `Duplicate GAME_PAYOUT ledger refs (${row.n})`,
        detail: { count: Number(row.n) },
      });
    }
  } catch {
    /* ignore */
  }

  try {
    await ensureWalletCommerceReady(db);
    const frozenOrphans = await db.all<{
      id: string;
      player_id: string;
      currency: string;
      amount_minor: number;
      status: string;
    }>(sql`
      SELECT id, player_id, currency, amount_minor, status FROM withdrawal_requests
      WHERE status IN ('PENDING','UNDER_REVIEW','APPROVED','PAYING')
        AND amount_minor <= 0
      LIMIT 20
    `);
    for (const row of frozenOrphans) {
      items.push({
        code: "ABNORMAL_FROZEN",
        severity: "HIGH",
        playerId: String(row.player_id),
        currency: String(row.currency),
        subjectType: "withdrawal_request",
        subjectId: String(row.id),
        message: "Open withdrawal hold with non-positive amount",
        detail: { amountMinor: Number(row.amount_minor), status: String(row.status) },
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const badStatus = await db.all<{ id: string; status: string }>(sql`
      SELECT id, status FROM wallet_intents
      WHERE status IN ('UNKNOWN', 'FAILED')
      ORDER BY created_at DESC LIMIT 20
    `);
    for (const row of badStatus) {
      items.push({
        code: "ABNORMAL_STATUS",
        severity: "MEDIUM",
        subjectType: "wallet_intent",
        subjectId: String(row.id),
        message: `Wallet intent status ${row.status}`,
        detail: { status: String(row.status) },
      });
    }
  } catch {
    /* ignore */
  }

  return {
    items: items.slice(0, Math.max(1, Math.min(200, limit))),
    scannedAt: new Date().toISOString(),
    autoFix: false,
  };
}

// ---------------------------------------------------------------------------
// Wallet intents / provider ops
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

export async function getWalletIntentDetail(db: AdminDb, id: string) {
  const intents = await db.all<Record<string, unknown>>(sql`
    SELECT id, player_id, idempotency_key, operation, status, currency, amount_minor,
           provider_op_id, ledger_tx_id, error_code, request_hash, created_at, updated_at
    FROM wallet_intents WHERE id = ${id} LIMIT 1
  `);
  const intent = intents[0];
  if (!intent) return null;

  const providerOps = await db.all<Record<string, unknown>>(sql`
    SELECT id, intent_id, idempotency_key, status, currency, amount_minor,
           direction, created_at, updated_at
    FROM wallet_provider_ops WHERE intent_id = ${id}
    ORDER BY created_at ASC
  `);

  const timeline: { at: string; stage: string; status: string; ref: string }[] = [
    {
      at: String(intent.created_at ?? ""),
      stage: "intent.created",
      status: String(intent.status ?? ""),
      ref: String(intent.id),
    },
  ];
  for (const op of providerOps) {
    timeline.push({
      at: String(op.created_at ?? op.updated_at ?? ""),
      stage: "provider_op",
      status: String(op.status ?? ""),
      ref: String(op.id),
    });
  }

  return { intent, providerOps, timeline };
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

export type LedgerListQuery = PageQuery & {
  playerId?: string;
  currency?: string;
  direction?: "DEBIT" | "CREDIT";
  roundId?: string;
  spinId?: string;
  referenceId?: string;
  depositOrderId?: string;
  withdrawalOrderId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function listLedgerTransactions(db: AdminDb, query: LedgerListQuery) {
  const where: string[] = [];
  const params: string[] = [];
  if (query.search) {
    where.push(
      "(t.id LIKE ? OR t.round_id LIKE ? OR t.idempotency_key LIKE ? OR EXISTS (SELECT 1 FROM ledger_entries e2 JOIN ledger_accounts a2 ON a2.id = e2.account_id WHERE e2.transaction_id = t.id AND a2.player_id LIKE ?))",
    );
    const like = `%${query.search}%`;
    params.push(like, like, like, like);
  }
  if (query.playerId) {
    where.push(
      "EXISTS (SELECT 1 FROM ledger_entries e JOIN ledger_accounts a ON a.id = e.account_id WHERE e.transaction_id = t.id AND a.player_id = ?)",
    );
    params.push(query.playerId);
  }
  if (query.status) {
    where.push("t.status = ?");
    params.push(query.status);
  }
  if (query.kind) {
    where.push("t.kind = ?");
    params.push(query.kind);
  }
  if (query.currency) {
    where.push(
      "EXISTS (SELECT 1 FROM ledger_entries e WHERE e.transaction_id = t.id AND e.currency = ?)",
    );
    params.push(query.currency);
  }
  if (query.roundId || query.spinId) {
    where.push("t.round_id = ?");
    params.push(String(query.roundId || query.spinId));
  }
  if (query.referenceId) {
    where.push("(t.id = ? OR t.round_id = ? OR t.idempotency_key LIKE ?)");
    params.push(query.referenceId, query.referenceId, `%${query.referenceId}%`);
  }
  if (query.depositOrderId) {
    where.push(
      "(t.idempotency_key LIKE ? OR t.id IN (SELECT ledger_tx_id FROM wallet_intents WHERE id LIKE ? OR idempotency_key LIKE ?))",
    );
    const like = `%${query.depositOrderId}%`;
    params.push(like, like, like);
  }
  if (query.withdrawalOrderId) {
    where.push(
      "(t.idempotency_key LIKE ? OR t.id IN (SELECT ledger_tx_id FROM wallet_intents WHERE id LIKE ? OR idempotency_key LIKE ?))",
    );
    const like = `%${query.withdrawalOrderId}%`;
    params.push(like, like, like);
  }
  if (query.dateFrom) {
    where.push("t.created_at >= ?");
    params.push(query.dateFrom);
  }
  if (query.dateTo) {
    where.push("t.created_at <= ?");
    params.push(query.dateTo);
  }
  if (query.direction === "DEBIT") {
    where.push(
      "EXISTS (SELECT 1 FROM ledger_entries e JOIN ledger_accounts a ON a.id = e.account_id WHERE e.transaction_id = t.id AND a.kind = 'PLAYER_AVAILABLE' AND e.amount_minor < 0)",
    );
  } else if (query.direction === "CREDIT") {
    where.push(
      "EXISTS (SELECT 1 FROM ledger_entries e JOIN ledger_accounts a ON a.id = e.account_id WHERE e.transaction_id = t.id AND a.kind = 'PLAYER_AVAILABLE' AND e.amount_minor > 0)",
    );
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (query.page - 1) * query.pageSize;
  const totalRows = await runRaw<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM ledger_transactions t ${whereSql}`,
    params,
  );
  const rows = await runRaw<Record<string, unknown>>(
    db,
    `
    SELECT t.id, t.idempotency_key, t.round_id, t.kind, t.status, t.request_hash, t.posted_at, t.created_at,
           (SELECT a.player_id FROM ledger_entries e
              JOIN ledger_accounts a ON a.id = e.account_id
             WHERE e.transaction_id = t.id AND a.player_id IS NOT NULL
             LIMIT 1) AS player_id,
           (SELECT e.currency FROM ledger_entries e WHERE e.transaction_id = t.id LIMIT 1) AS currency,
           (SELECT e.amount_minor FROM ledger_entries e
              JOIN ledger_accounts a ON a.id = e.account_id
             WHERE e.transaction_id = t.id AND a.kind = 'PLAYER_AVAILABLE'
             ORDER BY e.sequence ASC LIMIT 1) AS player_amount_minor,
           (SELECT e.balance_after_minor FROM ledger_entries e
              JOIN ledger_accounts a ON a.id = e.account_id
             WHERE e.transaction_id = t.id AND a.kind = 'PLAYER_AVAILABLE'
             ORDER BY e.sequence DESC LIMIT 1) AS balance_after_minor
    FROM ledger_transactions t ${whereSql}
    ORDER BY t.created_at DESC
    LIMIT ${Math.floor(query.pageSize)} OFFSET ${Math.floor(offset)}
  `,
    params,
  );
  const items = rows.map((row) => {
    const amount = Number(row.player_amount_minor ?? 0);
    const balanceAfter = row.balance_after_minor == null ? null : Number(row.balance_after_minor);
    const balanceBefore =
      balanceAfter == null || row.player_amount_minor == null ? null : balanceAfter - amount;
    return {
      ...row,
      reference_type: row.round_id ? "ROUND" : String(row.kind ?? "LEDGER"),
      reference_id: row.round_id ? String(row.round_id) : String(row.id),
      direction: amount < 0 ? "DEBIT" : amount > 0 ? "CREDIT" : "N/A",
      amount_minor: amount,
      balance_before_minor: balanceBefore,
      balance_after_minor: balanceAfter,
      spin_id: row.round_id ? String(row.round_id) : null,
    };
  });
  return { total: Number(totalRows[0]?.n ?? 0), page: query.page, pageSize: query.pageSize, items };
}

export async function getLedgerTransactionDetail(db: AdminDb, txId: string) {
  const txs = await db.all<Record<string, unknown>>(sql`
    SELECT id, idempotency_key, round_id, kind, status, request_hash, posted_at, created_at
    FROM ledger_transactions WHERE id = ${txId} LIMIT 1
  `);
  const tx = txs[0];
  if (!tx) return null;
  const entries = await db.all<Record<string, unknown>>(sql`
    SELECT e.id, e.transaction_id, e.account_id, e.sequence, e.amount_minor, e.currency,
           e.balance_after_minor, e.created_at, a.kind AS account_kind, a.player_id
    FROM ledger_entries e
    LEFT JOIN ledger_accounts a ON a.id = e.account_id
    WHERE e.transaction_id = ${txId}
    ORDER BY e.sequence ASC
  `);
  const playerEntry = entries.find((e) => String(e.account_kind) === "PLAYER_AVAILABLE") ?? entries[0];
  const amountMinor = playerEntry ? Number(playerEntry.amount_minor ?? 0) : 0;
  const balanceAfter =
    playerEntry?.balance_after_minor == null ? null : Number(playerEntry.balance_after_minor);
  const balanceBefore =
    balanceAfter == null ? null : balanceAfter - amountMinor;
  const entrySum = entries.reduce((acc, e) => acc + Number(e.amount_minor ?? 0), 0);
  const reconStatus =
    entries.length === 0
      ? "UNKNOWN"
      : entrySum === 0
        ? "MATCH"
        : "MISMATCH";
  const playerId = entries.find((e) => e.player_id)?.player_id
    ? String(entries.find((e) => e.player_id)!.player_id)
    : null;
  const walletId = entries.find((e) => String(e.account_kind) === "PLAYER_AVAILABLE")?.account_id
    ? String(entries.find((e) => String(e.account_kind) === "PLAYER_AVAILABLE")!.account_id)
    : null;
  const roundId = tx.round_id ? String(tx.round_id) : null;
  let round: Record<string, unknown> | null = null;
  if (roundId) {
    const rounds = await db.all<Record<string, unknown>>(sql`
      SELECT id, player_id, status, currency, total_bet_minor, total_win_minor,
             balance_after_minor, created_at, settled_at
      FROM game_rounds WHERE id = ${roundId} LIMIT 1
    `);
    round = rounds[0] ?? null;
  }
  const links = {
    playerId,
    roundId,
    spinId: roundId,
    ledgerId: String(tx.id),
  };
  return {
    ledgerId: String(tx.id),
    playerId,
    walletId,
    currency: playerEntry ? String(playerEntry.currency ?? "") : null,
    type: String(tx.kind ?? ""),
    direction: amountMinor < 0 ? "DEBIT" : amountMinor > 0 ? "CREDIT" : "N/A",
    amountMinor,
    balanceBeforeMinor: balanceBefore,
    balanceAfterMinor: balanceAfter,
    referenceType: roundId ? "ROUND" : String(tx.kind ?? "LEDGER"),
    referenceId: roundId ?? String(tx.id),
    createdAt: String(tx.created_at ?? ""),
    postedAt: tx.posted_at ? String(tx.posted_at) : null,
    status: String(tx.status ?? ""),
    idempotencyKey: String(tx.idempotency_key ?? ""),
    requestHash: String(tx.request_hash ?? ""),
    entries: entries.map((e) => ({
      id: String(e.id),
      accountId: String(e.account_id),
      accountKind: e.account_kind ? String(e.account_kind) : null,
      playerId: e.player_id ? String(e.player_id) : null,
      sequence: Number(e.sequence ?? 0),
      amountMinor: Number(e.amount_minor ?? 0),
      currency: String(e.currency ?? ""),
      balanceAfterMinor: Number(e.balance_after_minor ?? 0),
      balanceBeforeMinor: Number(e.balance_after_minor ?? 0) - Number(e.amount_minor ?? 0),
      createdAt: String(e.created_at ?? ""),
    })),
    reconciliation: {
      status: reconStatus as "MATCH" | "MISMATCH" | "UNKNOWN",
      entrySumMinor: entrySum,
      rule: "Σ(entry.amount_minor) == 0 for double-entry; player: before + amount = after",
      playerCheck:
        balanceBefore == null || balanceAfter == null
          ? "UNKNOWN"
          : balanceBefore + amountMinor === balanceAfter
            ? "MATCH"
            : "MISMATCH",
    },
    round,
    spin: round
      ? { id: roundId, aliasOf: "game_rounds", note: "Spin ≡ Round 1:1 in this schema" }
      : null,
    links,
  };
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
    SELECT m.id, m.sha256, m.status, m.config_json, m.activated_at, m.created_at,
           COALESCE(s.session_count, 0) AS session_count,
           COALESCE(r.round_count, 0) AS round_count
    FROM game_math_versions m
    LEFT JOIN (
      SELECT math_version_id, COUNT(*) AS session_count
      FROM game_sessions GROUP BY math_version_id
    ) s ON s.math_version_id = m.id
    LEFT JOIN (
      SELECT math_version_id, COUNT(*) AS round_count
      FROM game_rounds GROUP BY math_version_id
    ) r ON r.math_version_id = m.id
    ORDER BY m.created_at DESC
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
    return {
      ...row,
      summary,
      sessionCount: Number(row.session_count ?? 0),
      roundCount: Number(row.round_count ?? 0),
    };
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
  const mathId = String(row.id);
  const usage = await db.all<{ session_count: number; round_count: number }>(sql`
    SELECT
      (SELECT COUNT(*) FROM game_sessions WHERE math_version_id = ${mathId}) AS session_count,
      (SELECT COUNT(*) FROM game_rounds WHERE math_version_id = ${mathId}) AS round_count
  `);
  return {
    ...row,
    config,
    sessionCount: Number(usage[0]?.session_count ?? 0),
    roundCount: Number(usage[0]?.round_count ?? 0),
  };
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

  const highFreq = await db.all<Record<string, unknown>>(sql`
    SELECT player_id, COUNT(*) AS n, MAX(created_at) AS last_seen
    FROM game_rounds
    WHERE date(created_at) = date('now')
    GROUP BY player_id
    HAVING COUNT(*) >= 30
    ORDER BY n DESC
    LIMIT 50
  `);
  for (const row of highFreq) {
    signals.push({
      type: "HIGH_FREQ_SPIN",
      level: "HIGH",
      playerId: String(row.player_id),
      subjectType: "player",
      subjectId: String(row.player_id),
      evidence: `rounds_today=${Number(row.n)}`,
      detectedAt: String(row.last_seen),
    });
  }

  // Honest signal: multi-device fingerprinting is not available in this schema.
  signals.push({
    type: "MULTI_DEVICE_UNAVAILABLE",
    level: "LOW",
    playerId: null,
    subjectType: "system",
    subjectId: "multi-device",
    evidence: "Device fingerprinting / multi-device correlation is not configured; no MULTI_DEVICE inventing",
    detectedAt: new Date().toISOString(),
  });

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

const HIGH_RISK_AUDIT_ACTIONS = [
  "player.freeze",
  "player.unfreeze",
  "player.ban",
  "session.revoke",
  "deposit.confirm",
  "withdraw.approve",
  "withdraw.reject",
  "withdraw.pay",
  "risk.status.change",
  "admin.change_role",
  "admin.reset_password",
  "admin.create",
  "admin.disable",
  "admin.enable",
  "system.config.update",
  "announcement.publish",
  "wallet.detail.view",
  "wallet.integrity.view",
];

export async function listAdminAuditLogs(
  db: AdminDb,
  query: PageQuery & {
    operator?: string;
    action?: string;
    targetId?: string;
    role?: string;
    dateFrom?: string;
    dateTo?: string;
    highRiskOnly?: boolean;
  },
) {
  const where: string[] = [];
  const params: string[] = [];
  if (query.search) {
    where.push("(l.admin_username LIKE ? OR l.action LIKE ? OR l.target_id LIKE ? OR l.request_id LIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like, like, like);
  }
  if (query.operator) {
    where.push("l.admin_username LIKE ?");
    params.push(`%${query.operator}%`);
  }
  if (query.action) {
    where.push("l.action = ?");
    params.push(query.action);
  }
  if (query.targetId) {
    where.push("l.target_id LIKE ?");
    params.push(`%${query.targetId}%`);
  }
  if (query.role) {
    where.push("l.admin_role = ?");
    params.push(query.role);
  }
  if (query.dateFrom) {
    where.push("l.created_at >= ?");
    params.push(query.dateFrom);
  }
  if (query.dateTo) {
    where.push("l.created_at <= ?");
    params.push(query.dateTo);
  }
  if (query.highRiskOnly) {
    const placeholders = HIGH_RISK_AUDIT_ACTIONS.map(() => "?").join(",");
    where.push(`l.action IN (${placeholders})`);
    params.push(...HIGH_RISK_AUDIT_ACTIONS);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (query.page - 1) * query.pageSize;
  const totalRows = await runRaw<{ n: number }>(db, `SELECT COUNT(*) AS n FROM admin_audit_logs l ${whereSql}`, params);
  const rows = await runRaw<Record<string, unknown>>(db, `
    SELECT l.id, l.admin_id, l.admin_username, l.admin_role, l.action, l.target_type, l.target_id,
           l.reason, l.ip, l.request_id, l.before_json, l.after_json, l.detail_json, l.created_at
    FROM admin_audit_logs l ${whereSql}
    ORDER BY l.created_at DESC
    LIMIT ${Math.floor(query.pageSize)} OFFSET ${Math.floor(offset)}
  `, params);
  // Never expose secret-like keys if mistakenly logged in detail_json.
  const scrubbed = rows.map((row) => {
    const next = { ...row };
    for (const key of ["before_json", "after_json", "detail_json"] as const) {
      const raw = next[key];
      if (typeof raw !== "string") continue;
      try {
        const parsed = JSON.parse(raw) as unknown;
        next[key] = JSON.stringify(scrubSecrets(parsed));
      } catch {
        /* keep */
      }
    }
    return next;
  });
  return {
    total: Number(totalRows[0]?.n ?? 0),
    page: query.page,
    pageSize: query.pageSize,
    items: scrubbed,
    immutable: true,
  };
}

function scrubSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubSecrets);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (/password|secret|token|private.?key|credential|otp|jwt|hash/i.test(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = scrubSecrets(v);
    }
  }
  return out;
}

export async function listGameAuditEvents(
  db: AdminDb,
  query: PageQuery & { playerId?: string; action?: string },
) {
  const where: string[] = [];
  const params: string[] = [];
  if (query.search) {
    where.push("(e.actor_id LIKE ? OR e.event_type LIKE ? OR e.subject_id LIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like, like);
  }
  if (query.playerId) {
    where.push("(e.actor_id = ? OR e.subject_id = ?)");
    params.push(query.playerId, query.playerId);
  }
  if (query.action) {
    where.push("e.event_type = ?");
    params.push(query.action);
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
    SELECT u.id, u.username, u.display_name, u.role, u.status, u.last_login_at, u.created_at, u.updated_at,
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

async function computeRetention(
  db: AdminDb,
  daysAgo: number,
): Promise<{ cohort: number; retained: number; rate: number | null }> {
  try {
    const cohortRows = await db.all<{ n: number }>(sql`
      SELECT COUNT(DISTINCT player_id) AS n FROM game_rounds
      WHERE date(created_at) = date('now', ${`-${daysAgo} day`})
    `);
    const retainedRows = await db.all<{ n: number }>(sql`
      SELECT COUNT(DISTINCT r1.player_id) AS n
      FROM game_rounds r1
      WHERE date(r1.created_at) = date('now', ${`-${daysAgo} day`})
        AND EXISTS (
          SELECT 1 FROM game_rounds r2
          WHERE r2.player_id = r1.player_id AND date(r2.created_at) = date('now')
        )
    `);
    const cohort = Number(cohortRows[0]?.n ?? 0);
    const retained = Number(retainedRows[0]?.n ?? 0);
    return {
      cohort,
      retained,
      rate: cohort > 0 ? (retained / cohort) * 100 : null,
    };
  } catch {
    return { cohort: 0, retained: 0, rate: null };
  }
}

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
  const mauRows = await db.all<{ n: number }>(sql`
    SELECT COUNT(DISTINCT player_id) AS n FROM game_rounds
    WHERE created_at >= strftime('%Y-%m-%d %H:%M:%S', 'now', '-30 days')
  `);
  const mau = Number(mauRows[0]?.n ?? 0);
  const retention = {
    d1: await computeRetention(db, 1),
    d7: await computeRetention(db, 7),
  };

  const rankRows = topPlayers.map((row) => {
    const totalBetMinor = Number(row.total_bet ?? 0);
    const totalWinMinor = Number(row.total_win ?? 0);
    return {
      playerId: String(row.player_id),
      spinCount: Number(row.spin_count ?? 0),
      totalBetMinor,
      totalWinMinor,
      profitMinor: totalBetMinor - totalWinMinor,
    };
  });
  const rankings = {
    byBet: [...rankRows].sort((a, b) => b.totalBetMinor - a.totalBetMinor),
    byWin: [...rankRows].sort((a, b) => b.totalWinMinor - a.totalWinMinor),
    byProfit: [...rankRows].sort((a, b) => b.profitMinor - a.profitMinor),
  };

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      onlineNow: dash.onlineNow,
      todayActive: dash.todayActive,
      dau: dash.todayActive,
      mau,
      spinCount: dash.spinCount,
      todayBetMinor: dash.todayBetMinor,
      todayPayoutMinor: dash.todayPayoutMinor,
      todayProfitMinor: dash.todayProfitMinor,
      rtpPercent: dash.rtpPercent,
      anomalyCount: dash.anomalyCount,
    },
    retention,
    rankings,
    hourly: dash.hourly,
    roundStatus: dash.roundStatus,
    sessionStatus,
    walletByOp,
    topPlayers: rankRows,
    health: {
      wallet: dash.wallet.ok,
      ledger: dash.ledger.ok,
      api: dash.api.ok,
      system: dash.system.ok,
    },
  };
}

export async function getSystemMonitor(db: AdminDb) {
  const started = Date.now();
  let selectOne = false;
  let latencyMs = 0;
  try {
    await db.all<{ n: number }>(sql`SELECT 1 AS n`);
    latencyMs = Date.now() - started;
    selectOne = true;
  } catch {
    latencyMs = Date.now() - started;
    selectOne = false;
  }

  let ledgerQueryable = false;
  try {
    await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM ledger_transactions LIMIT 1`);
    ledgerQueryable = true;
  } catch {
    ledgerQueryable = false;
  }

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
    database: { ok: selectOne, latencyMs },
    probes: { selectOne, ledgerQueryable },
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

// ---------------------------------------------------------------------------
// Games read models (single official title: 牛魔王 / bull-demon-king)
// ---------------------------------------------------------------------------

export type GameRuntimeStatus = "ACTIVE" | "MAINTENANCE" | "DISABLED" | "UNKNOWN";

type ActiveMathSnapshot = {
  mathVersionId: string | null;
  mathSha256: string | null;
  mathStatus: string | null;
  versionLabel: string | null;
  buildLabel: string | null;
  paytableVersion: string | null;
  rtpIdentifier: string | number | null;
  activatedAt: string | null;
  source: string;
};

async function resolveGameRuntimeStatus(db: AdminDb): Promise<{
  status: GameRuntimeStatus;
  statusSource: string;
  modelLimitation: string | null;
}> {
  try {
    const rows = await db.all<{ value_json: string }>(sql`
      SELECT value_json FROM admin_system_config WHERE "key" = 'maintenance_mode' LIMIT 1
    `);
    if (!rows[0]) {
      return {
        status: "ACTIVE",
        statusSource: "default_no_maintenance_row",
        modelLimitation:
          "CURRENT MODEL LIMITATION: no DISABLED game-status enum; only maintenance_mode boolean + ACTIVE default.",
      };
    }
    let enabled = false;
    try {
      const parsed = JSON.parse(String(rows[0].value_json ?? "{}")) as { enabled?: unknown };
      enabled = parsed.enabled === true;
    } catch {
      return {
        status: "UNKNOWN",
        statusSource: "maintenance_mode_parse_error",
        modelLimitation:
          "CURRENT MODEL LIMITATION: maintenance_mode value_json unparseable; status UNKNOWN (not forged).",
      };
    }
    return {
      status: enabled ? "MAINTENANCE" : "ACTIVE",
      statusSource: "admin_system_config.maintenance_mode",
      modelLimitation:
        "CURRENT MODEL LIMITATION: DISABLED is not a persisted game state; only ACTIVE/MAINTENANCE derived from maintenance_mode.",
    };
  } catch (cause) {
    return {
      status: "UNKNOWN",
      statusSource: "ERROR",
      modelLimitation: `CURRENT MODEL LIMITATION: status probe failed (${cause instanceof Error ? cause.message : String(cause)}).`,
    };
  }
}

async function resolveActiveMath(db: AdminDb): Promise<ActiveMathSnapshot> {
  const empty: ActiveMathSnapshot = {
    mathVersionId: null,
    mathSha256: null,
    mathStatus: null,
    versionLabel: null,
    buildLabel: null,
    paytableVersion: null,
    rtpIdentifier: null,
    activatedAt: null,
    source: "NOT_AVAILABLE",
  };
  try {
    const rows = await db.all<Record<string, unknown>>(sql`
      SELECT id, sha256, status, config_json, activated_at, created_at
      FROM game_math_versions
      WHERE status = 'FROZEN'
      ORDER BY
        CASE WHEN activated_at IS NULL THEN 1 ELSE 0 END ASC,
        activated_at DESC,
        created_at DESC
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return empty;
    let versionLabel: string | null = null;
    let buildLabel: string | null = null;
    let paytableVersion: string | null = null;
    let rtpIdentifier: string | number | null = null;
    try {
      const config = JSON.parse(String(row.config_json ?? "{}")) as Record<string, unknown>;
      versionLabel =
        typeof config.version === "string" || typeof config.version === "number"
          ? String(config.version)
          : typeof config.gameVersion === "string" || typeof config.gameVersion === "number"
            ? String(config.gameVersion)
            : String(row.id);
      buildLabel =
        typeof config.build === "string" || typeof config.build === "number"
          ? String(config.build)
          : typeof config.buildId === "string" || typeof config.buildId === "number"
            ? String(config.buildId)
            : null;
      const pay =
        config.paytableVersion ?? config.paytable ?? config.paytableId ?? null;
      paytableVersion = pay == null ? null : String(pay);
      const rtp = config.theoreticalRtp ?? config.rtp ?? config.rtpIdentifier ?? null;
      rtpIdentifier =
        typeof rtp === "number" || typeof rtp === "string" ? rtp : rtp == null ? null : String(rtp);
    } catch {
      versionLabel = String(row.id);
    }
    return {
      mathVersionId: String(row.id),
      mathSha256: String(row.sha256 ?? ""),
      mathStatus: String(row.status ?? ""),
      versionLabel,
      buildLabel,
      paytableVersion,
      rtpIdentifier,
      activatedAt: row.activated_at == null ? null : String(row.activated_at),
      source: "game_math_versions.status=FROZEN",
    };
  } catch {
    return { ...empty, source: "ERROR" };
  }
}

export async function listGames(db: AdminDb) {
  const runtime = await resolveGameRuntimeStatus(db);
  const math = await resolveActiveMath(db);

  let onlineSessions = 0;
  let onlineAvailability: MetricAvailability = "OK";
  let onlineError: string | undefined;
  try {
    const online = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM game_sessions
      WHERE status = 'OPEN' AND expires_at > strftime('%Y-%m-%d %H:%M:%S', 'now')
    `);
    onlineSessions = Number(online[0]?.n ?? 0);
  } catch (cause) {
    onlineAvailability = "ERROR";
    onlineError = cause instanceof Error ? cause.message : String(cause);
  }

  let todayRounds = 0;
  let todayPlayers = 0;
  let todayBetMinor = 0;
  let todayWinMinor = 0;
  let todayAvailability: MetricAvailability = "OK";
  let todayError: string | undefined;
  let lastActivityAt: string | null = null;
  try {
    const today = await db.all<{
      spins: number;
      players: number;
      bet: number;
      win: number;
    }>(sql`
      SELECT COUNT(*) AS spins,
             COUNT(DISTINCT player_id) AS players,
             COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN total_bet_minor ELSE 0 END), 0) AS bet,
             COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN total_win_minor ELSE 0 END), 0) AS win
      FROM game_rounds WHERE date(created_at) = date('now')
    `);
    todayRounds = Number(today[0]?.spins ?? 0);
    todayPlayers = Number(today[0]?.players ?? 0);
    todayBetMinor = Number(today[0]?.bet ?? 0);
    todayWinMinor = Number(today[0]?.win ?? 0);
    const last = await db.all<{ last_at: string | null }>(sql`
      SELECT MAX(created_at) AS last_at FROM game_rounds
    `);
    lastActivityAt = last[0]?.last_at == null ? null : String(last[0].last_at);
  } catch (cause) {
    todayAvailability = "ERROR";
    todayError = cause instanceof Error ? cause.message : String(cause);
  }

  return {
    items: [{
      id: OFFICIAL_GAME.id,
      code: OFFICIAL_GAME.code,
      nameZh: OFFICIAL_GAME.nameZh,
      nameEn: OFFICIAL_GAME.nameEn,
      status: runtime.status,
      statusSource: runtime.statusSource,
      version: math.versionLabel,
      build: math.buildLabel,
      mathVersionId: math.mathVersionId,
      mathVersion: math.mathVersionId,
      paytableVersion: math.paytableVersion,
      rtpIdentifier: math.rtpIdentifier,
      // Honest session metric — NOT websocket presence / NOT last-login count.
      onlineSessions,
      onlineSessionsAvailability: onlineAvailability,
      onlinePlayers: null,
      onlinePlayersAvailability: "NOT_AVAILABLE" as MetricAvailability,
      onlinePlayersNote:
        "NOT AVAILABLE: no reliable presence channel. Do not treat last-login or open-session counts as live online players.",
      todayPlayers,
      todayRounds,
      todaySpins: todayRounds,
      todayBetMinor,
      todayWinMinor,
      todayAvailability,
      todayError: todayError ?? null,
      onlineError: onlineError ?? null,
      lastActivityAt,
      spinModel: "ROUND_ALIAS",
    }],
    modelLimitations: [
      runtime.modelLimitation,
      "No games catalog table — single official title bull-demon-king only; never invent fake future games.",
      "Spin ≡ game_rounds (1:1 alias).",
      "onlinePlayers is NOT AVAILABLE (no presence); onlineSessions = OPEN unexpired game_sessions only.",
    ].filter(Boolean),
  };
}

export async function listGameAnomalies(db: AdminDb, limit = 50) {
  const capped = Math.min(100, Math.max(1, Math.floor(limit)));
  const items: Array<{
    code: string;
    severity: "WARN" | "CRITICAL";
    roundId: string;
    playerId: string;
    status: string;
    betMinor: number;
    winMinor: number | null;
    ledgerReferenceCount: number;
    createdAt: string;
    note: string;
  }> = [];

  const pending = await db.all<Record<string, unknown>>(sql`
    SELECT id, player_id, status, total_bet_minor, total_win_minor, created_at
    FROM game_rounds
    WHERE status = 'PENDING'
    ORDER BY created_at ASC
    LIMIT ${capped}
  `);
  for (const row of pending) {
    items.push({
      code: "ROUND_INCOMPLETE",
      severity: "WARN",
      roundId: String(row.id),
      playerId: String(row.player_id),
      status: String(row.status),
      betMinor: Number(row.total_bet_minor ?? 0),
      winMinor: row.total_win_minor == null ? null : Number(row.total_win_minor),
      ledgerReferenceCount: 0,
      createdAt: String(row.created_at),
      note: "Round not completed.",
    });
  }

  const missingLedger = await db.all<Record<string, unknown>>(sql`
    SELECT r.id, r.player_id, r.status, r.total_bet_minor, r.total_win_minor, r.created_at,
           COALESCE(c.n, 0) AS ledger_n
    FROM game_rounds r
    LEFT JOIN (
      SELECT round_id, COUNT(*) AS n FROM ledger_transactions GROUP BY round_id
    ) c ON c.round_id = r.id
    WHERE r.status = 'SETTLED' AND COALESCE(c.n, 0) = 0
    ORDER BY r.created_at DESC
    LIMIT ${capped}
  `);
  for (const row of missingLedger) {
    items.push({
      code: "SPIN_MISSING_LEDGER_REFERENCE",
      severity: "CRITICAL",
      roundId: String(row.id),
      playerId: String(row.player_id),
      status: String(row.status),
      betMinor: Number(row.total_bet_minor ?? 0),
      winMinor: row.total_win_minor == null ? null : Number(row.total_win_minor),
      ledgerReferenceCount: Number(row.ledger_n ?? 0),
      createdAt: String(row.created_at),
      note: "Settled round missing ledger reference.",
    });
  }

  const dupLedger = await db.all<Record<string, unknown>>(sql`
    SELECT round_id, COUNT(*) AS n
    FROM ledger_transactions
    WHERE round_id IS NOT NULL
    GROUP BY round_id
    HAVING COUNT(*) > 4
    ORDER BY n DESC
    LIMIT ${capped}
  `);
  for (const row of dupLedger) {
    items.push({
      code: "DUPLICATE_LEDGER_REFERENCE",
      severity: "WARN",
      roundId: String(row.round_id),
      playerId: "NOT_AVAILABLE",
      status: "SETTLED",
      betMinor: 0,
      winMinor: null,
      ledgerReferenceCount: Number(row.n ?? 0),
      createdAt: "NOT_AVAILABLE",
      note: "Unusually high ledger_transactions count for one round (read-only flag).",
    });
  }

  return {
    total: items.length,
    items: items.slice(0, capped),
    readOnly: true,
    autoRepair: false,
  };
}

export async function getGameHealth(db: AdminDb, gameId: string) {
  if (gameId !== OFFICIAL_GAME.id && gameId !== OFFICIAL_GAME.code) return null;
  const started = Date.now();
  let dbOk = false;
  let dbLatencyMs = 0;
  try {
    await db.all<{ n: number }>(sql`SELECT 1 AS n`);
    dbOk = true;
    dbLatencyMs = Date.now() - started;
  } catch {
    dbLatencyMs = Date.now() - started;
  }

  const openSessions = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM game_sessions
    WHERE status = 'OPEN' AND expires_at > strftime('%Y-%m-%d %H:%M:%S', 'now')
  `);
  const pendingRounds = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM game_rounds WHERE status = 'PENDING'
  `);
  const lastSpin = await db.all<{ last_at: string | null }>(sql`
    SELECT MAX(created_at) AS last_at FROM game_rounds WHERE status = 'SETTLED'
  `);
  let lastError: { created_at: string; event_type: string }[] = [];
  try {
    lastError = await db.all<{ created_at: string; event_type: string }>(sql`
      SELECT created_at, event_type FROM game_audit_events
      WHERE event_type LIKE '%ERROR%' OR event_type LIKE '%FAIL%'
      ORDER BY created_at DESC LIMIT 1
    `);
  } catch {
    lastError = [];
  }

  const ledger = await getLedgerHealth(db);
  const anomalies = await listGameAnomalies(db, 20);

  return {
    gameId: OFFICIAL_GAME.id,
    checkedAt: new Date().toISOString(),
    components: {
      gameApi: { ok: true, note: "Admin read path reachable" },
      session: { ok: true, openSessions: Number(openSessions[0]?.n ?? 0) },
      spinService: {
        ok: Number(pendingRounds[0]?.n ?? 0) < 100,
        pendingRounds: Number(pendingRounds[0]?.n ?? 0),
        lastSuccessfulSpinAt: lastSpin[0]?.last_at == null ? null : String(lastSpin[0].last_at),
      },
      db: { ok: dbOk, latencyMs: dbLatencyMs },
      ledger: { ok: ledger.ok, unbalancedTx: ledger.unbalancedTx },
    },
    lastError:
      lastError[0]
        ? { at: String(lastError[0].created_at), type: String(lastError[0].event_type) }
        : null,
    anomalyCount: anomalies.total,
    secretsRedacted: true,
  };
}

export async function getGameOps(db: AdminDb, gameId: string) {
  if (gameId !== OFFICIAL_GAME.id && gameId !== OFFICIAL_GAME.code) {
    return null;
  }
  const runtime = await resolveGameRuntimeStatus(db);
  const math = await resolveActiveMath(db);
  const health = await getGameHealth(db, gameId);
  const anomalies = await listGameAnomalies(db, 30);

  const online = await db.all<{ sessions: number; players: number }>(sql`
    SELECT COUNT(*) AS sessions,
           COUNT(DISTINCT player_id) AS players
    FROM game_sessions
    WHERE status = 'OPEN' AND expires_at > strftime('%Y-%m-%d %H:%M:%S', 'now')
  `);

  const agg = await db.all<{
    spins: number;
    players: number;
    bet: number;
    win: number;
    free_games: number;
  }>(sql`
    SELECT COUNT(*) AS spins,
           COUNT(DISTINCT player_id) AS players,
           COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN total_bet_minor ELSE 0 END), 0) AS bet,
           COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN total_win_minor ELSE 0 END), 0) AS win,
           COALESCE(SUM(CASE WHEN is_free_game = 1 THEN 1 ELSE 0 END), 0) AS free_games
    FROM game_rounds WHERE date(created_at) = date('now')
  `);

  const lastActivity = await db.all<{ last_at: string | null }>(sql`
    SELECT MAX(created_at) AS last_at FROM game_rounds
  `);

  const outcomes = await db.all<{ outcome_json: string | null }>(sql`
    SELECT outcome_json FROM game_rounds
    WHERE date(created_at) = date('now') AND outcome_json IS NOT NULL
    LIMIT 5000
  `);
  let big = 0;
  let mega = 0;
  let ultra = 0;
  let jackpot = 0;
  for (const row of outcomes) {
    const text = String(row.outcome_json ?? "").toLowerCase();
    if (text.includes("jackpot")) jackpot += 1;
    else if (text.includes("ultra")) ultra += 1;
    else if (text.includes("mega")) mega += 1;
    else if (text.includes("big")) big += 1;
  }

  return {
    game: {
      id: OFFICIAL_GAME.id,
      code: OFFICIAL_GAME.code,
      nameZh: OFFICIAL_GAME.nameZh,
      nameEn: OFFICIAL_GAME.nameEn,
      status: runtime.status,
      statusSource: runtime.statusSource,
      version: math.versionLabel,
      build: math.buildLabel,
      mathVersionId: math.mathVersionId,
      mathSha256: math.mathSha256,
      mathStatus: math.mathStatus,
      paytableVersion: math.paytableVersion,
      rtpIdentifier: math.rtpIdentifier,
      mathSource: math.source,
      activatedAt: math.activatedAt,
    },
    today: {
      spins: Number(agg[0]?.spins ?? 0),
      rounds: Number(agg[0]?.spins ?? 0),
      players: Number(agg[0]?.players ?? 0),
      betMinor: Number(agg[0]?.bet ?? 0),
      winMinor: Number(agg[0]?.win ?? 0),
      freeGames: Number(agg[0]?.free_games ?? 0),
    },
    presence: {
      openSessions: Number(online[0]?.sessions ?? 0),
      openSessionPlayers: Number(online[0]?.players ?? 0),
      onlinePlayers: null,
      onlinePlayersAvailability: "NOT_AVAILABLE",
      note: "Open sessions are not live presence. onlinePlayers = NOT AVAILABLE.",
    },
    lastActivityAt: lastActivity[0]?.last_at == null ? null : String(lastActivity[0].last_at),
    jackpotEvents: { big, mega, ultra, jackpot },
    health,
    anomalies: {
      total: anomalies.total,
      items: anomalies.items.slice(0, 20),
      readOnly: true,
    },
    readonly: {
      math: true,
      rtp: true,
      rng: true,
      paytable: true,
      forceWin: false,
    },
    modelLimitations: [
      runtime.modelLimitation,
      "RTP / Math / Paytable are read-only identifiers from FROZEN math config — no edit API.",
      "Spin ≡ Round alias model.",
    ].filter(Boolean),
  };
}

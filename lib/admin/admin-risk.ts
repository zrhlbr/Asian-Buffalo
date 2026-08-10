/**
 * ADMIN-1E — Persisted Risk Events + notes + overview.
 * Detection reuses getRiskSignals + listMoneyIntegrityExceptions (no second money model).
 * Status changes NEVER auto-freeze, auto-debit, or mutate ledger/round/spin.
 */

import { sql } from "drizzle-orm";
import type { AdminDb, PageQuery } from "./admin-queries.ts";
import {
  getRiskSignals,
  listMoneyIntegrityExceptions,
  type RiskSignal,
} from "./admin-queries.ts";
import { ensureWalletCommerceReady } from "../wallet-commerce-bootstrap.ts";

async function runRaw<T>(
  db: AdminDb,
  statement: string,
  params: (string | number)[],
): Promise<T[]> {
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
  return [];
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RiskStatus = "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED";
export type RiskCategory =
  | "AUTH"
  | "SESSION"
  | "DEVICE"
  | "IP"
  | "GAMEPLAY"
  | "WALLET"
  | "LEDGER"
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "ADMIN_SECURITY";

export type CapabilityState = "IMPLEMENTED" | "PARTIAL" | "NOT_AVAILABLE";

export type RiskEventRow = {
  id: string;
  fingerprint: string;
  playerId: string | null;
  type: string;
  category: RiskCategory;
  level: RiskLevel;
  status: RiskStatus;
  evidenceSummary: string;
  subjectType: string | null;
  subjectId: string | null;
  relatedReference: string | null;
  source: string;
  detectedAt: string | null;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolveReason: string | null;
  createdAt: string;
};

function nowSql(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function categoryOf(type: string, source: string): RiskCategory {
  if (source === "money_integrity") return "LEDGER";
  switch (type) {
    case "DANGEROUS_BEHAVIOR":
    case "REVOKED_SESSION_REUSE":
      return "SESSION";
    case "MULTI_DEVICE_UNAVAILABLE":
    case "MULTI_DEVICE":
      return "DEVICE";
    case "MULTI_IP_SWITCH":
    case "SHARED_IP_MULTI_ACCOUNT":
      return "IP";
    case "AUTH_FAIL_BURST":
    case "LOGIN_ANOMALY":
      return "AUTH";
    case "PROVIDER_TIMEOUT":
    case "RECOVERY":
      return "WALLET";
    case "ABNORMAL_BALANCE":
    case "DUPLICATE_SETTLEMENT":
    case "BALANCE_MISMATCH":
    case "MISSING_REFERENCE":
    case "DUPLICATE_REFERENCE":
    case "NEGATIVE_BALANCE":
    case "ABNORMAL_FROZEN":
    case "ENTRY_RECON_MISMATCH":
      return "LEDGER";
    case "DEPOSIT_FAIL_BURST":
    case "DEPOSIT_STATUS_ANOMALY":
    case "DUPLICATE_DEPOSIT":
      return "DEPOSIT";
    case "WITHDRAW_FAIL_BURST":
    case "WITHDRAW_STATUS_ANOMALY":
    case "DUPLICATE_DESTINATION":
      return "WITHDRAWAL";
    case "ADMIN_AUTH_FAILURE":
    case "ADMIN_PRIVILEGE_CHANGE":
      return "ADMIN_SECURITY";
    default:
      return "GAMEPLAY";
  }
}

function fingerprintOf(input: {
  type: string;
  subjectType: string;
  subjectId: string;
  playerId: string | null;
}): string {
  return `${input.type}|${input.subjectType}|${input.subjectId}|${input.playerId ?? ""}`;
}

type Candidate = {
  type: string;
  level: RiskLevel;
  playerId: string | null;
  subjectType: string;
  subjectId: string;
  evidence: string;
  detectedAt: string | null;
  source: string;
  relatedReference?: string | null;
};

function fromSignal(signal: RiskSignal): Candidate {
  return {
    type: signal.type,
    level: signal.level,
    playerId: signal.playerId,
    subjectType: signal.subjectType,
    subjectId: signal.subjectId,
    evidence: signal.evidence,
    detectedAt: signal.detectedAt,
    source: "signal",
    relatedReference: signal.subjectId,
  };
}

async function collectDepositWithdrawCandidates(db: AdminDb): Promise<Candidate[]> {
  const out: Candidate[] = [];
  try {
    await ensureWalletCommerceReady(db);
  } catch {
    return out;
  }
  try {
    const failDeposits = await db.all<{ player_id: string; n: number; last_seen: string }>(sql`
      SELECT player_id, COUNT(*) AS n, MAX(created_at) AS last_seen
      FROM deposit_orders
      WHERE status IN ('FAILED', 'REJECTED')
        AND date(created_at) = date('now')
      GROUP BY player_id HAVING COUNT(*) >= 3
      LIMIT 30
    `);
    for (const row of failDeposits) {
      out.push({
        type: "DEPOSIT_FAIL_BURST",
        level: Number(row.n) >= 5 ? "HIGH" : "MEDIUM",
        playerId: String(row.player_id),
        subjectType: "player",
        subjectId: String(row.player_id),
        evidence: `failed_deposits_today=${Number(row.n)}`,
        detectedAt: String(row.last_seen),
        source: "deposit",
      });
    }
  } catch {
    /* table optional */
  }
  try {
    const failWd = await db.all<{ player_id: string; n: number; last_seen: string }>(sql`
      SELECT player_id, COUNT(*) AS n, MAX(created_at) AS last_seen
      FROM withdrawal_requests
      WHERE status IN ('FAILED', 'REJECTED')
        AND date(created_at) = date('now')
      GROUP BY player_id HAVING COUNT(*) >= 3
      LIMIT 30
    `);
    for (const row of failWd) {
      out.push({
        type: "WITHDRAW_FAIL_BURST",
        level: Number(row.n) >= 5 ? "HIGH" : "MEDIUM",
        playerId: String(row.player_id),
        subjectType: "player",
        subjectId: String(row.player_id),
        evidence: `failed_withdrawals_today=${Number(row.n)}`,
        detectedAt: String(row.last_seen),
        source: "withdrawal",
      });
    }
  } catch {
    /* optional */
  }
  try {
    const dupDest = await db.all<{ account_masked: string; n: number; last_seen: string }>(sql`
      SELECT account_masked, COUNT(DISTINCT player_id) AS n, MAX(created_at) AS last_seen
      FROM withdrawal_requests
      WHERE account_masked IS NOT NULL AND length(account_masked) > 2
      GROUP BY account_masked
      HAVING COUNT(DISTINCT player_id) >= 3
      LIMIT 20
    `);
    for (const row of dupDest) {
      out.push({
        type: "DUPLICATE_DESTINATION",
        level: "MEDIUM",
        playerId: null,
        subjectType: "destination",
        subjectId: String(row.account_masked).slice(0, 24),
        evidence: `masked_destination_shared_by_players=${Number(row.n)}`,
        detectedAt: String(row.last_seen),
        source: "withdrawal",
        relatedReference: String(row.account_masked),
      });
    }
  } catch {
    /* optional */
  }
  return out;
}

async function collectIpSessionCandidates(db: AdminDb): Promise<{
  candidates: Candidate[];
  authCapability: CapabilityState;
  ipCapability: CapabilityState;
}> {
  const candidates: Candidate[] = [];
  let authCapability: CapabilityState = "NOT_AVAILABLE";
  let ipCapability: CapabilityState = "NOT_AVAILABLE";
  try {
    const multiIp = await db.all<{ player_id: string; n: number; last_seen: string }>(sql`
      SELECT player_id, COUNT(DISTINCT ip) AS n, MAX(COALESCE(last_seen_at, created_at)) AS last_seen
      FROM player_auth_sessions
      WHERE ip IS NOT NULL AND date(COALESCE(last_seen_at, created_at)) = date('now')
      GROUP BY player_id
      HAVING COUNT(DISTINCT ip) >= 3
      LIMIT 30
    `);
    ipCapability = "PARTIAL";
    authCapability = "PARTIAL";
    for (const row of multiIp) {
      candidates.push({
        type: "MULTI_IP_SWITCH",
        level: Number(row.n) >= 5 ? "HIGH" : "MEDIUM",
        playerId: String(row.player_id),
        subjectType: "player",
        subjectId: String(row.player_id),
        evidence: `distinct_ip_today=${Number(row.n)} (masked in UI)`,
        detectedAt: String(row.last_seen),
        source: "auth_session",
      });
    }
  } catch {
    authCapability = "NOT_AVAILABLE";
    ipCapability = "NOT_AVAILABLE";
  }
  return { candidates, authCapability, ipCapability };
}

export async function syncRiskEvents(db: AdminDb): Promise<{
  upserted: number;
  scannedAt: string;
  authCapability: CapabilityState;
  ipCapability: CapabilityState;
}> {
  const signals = await getRiskSignals(db);
  const integrity = await listMoneyIntegrityExceptions(db, 100);
  const moneyCandidates: Candidate[] = integrity.items.map((item) => ({
    type: String(item.code),
    level: (item.severity === "CRITICAL"
      ? "CRITICAL"
      : item.severity === "HIGH"
        ? "HIGH"
        : item.severity === "MEDIUM"
          ? "MEDIUM"
          : "LOW") as RiskLevel,
    playerId: item.playerId ?? null,
    subjectType: item.subjectType,
    subjectId: item.subjectId,
    evidence: item.message,
    detectedAt: integrity.scannedAt,
    source: "money_integrity",
    relatedReference: item.subjectId,
  }));
  const dw = await collectDepositWithdrawCandidates(db);
  const ipAuth = await collectIpSessionCandidates(db);
  const all = [
    ...signals.map(fromSignal),
    ...moneyCandidates,
    ...dw,
    ...ipAuth.candidates,
  ];

  let upserted = 0;
  const ts = nowSql();
  for (const item of all) {
    const fp = fingerprintOf(item);
    const category = categoryOf(item.type, item.source);
    const existing = await db.all<{ id: string; status: string }>(sql`
      SELECT id, status FROM admin_risk_events WHERE fingerprint = ${fp} LIMIT 1
    `);
    if (existing[0]) {
      const status = String(existing[0].status);
      if (status === "RESOLVED" || status === "DISMISSED") {
        continue;
      }
      await db.run(sql`
        UPDATE admin_risk_events SET
          level = ${item.level},
          evidence_summary = ${item.evidence},
          related_reference = ${item.relatedReference ?? item.subjectId},
          updated_at = ${ts},
          detected_at = COALESCE(detected_at, ${item.detectedAt})
        WHERE id = ${existing[0].id}
      `);
      upserted += 1;
    } else {
      const id = crypto.randomUUID();
      await db.run(sql`
        INSERT INTO admin_risk_events (
          id, fingerprint, player_id, type, category, level, status,
          evidence_summary, subject_type, subject_id, related_reference,
          source, detected_at, updated_at, created_at
        ) VALUES (
          ${id}, ${fp}, ${item.playerId}, ${item.type}, ${category}, ${item.level}, 'OPEN',
          ${item.evidence}, ${item.subjectType}, ${item.subjectId},
          ${item.relatedReference ?? item.subjectId},
          ${item.source}, ${item.detectedAt}, ${ts}, ${ts}
        )
      `);
      upserted += 1;
    }
  }
  return {
    upserted,
    scannedAt: new Date().toISOString(),
    authCapability: ipAuth.authCapability,
    ipCapability: ipAuth.ipCapability,
  };
}

function mapRow(row: Record<string, unknown>): RiskEventRow {
  return {
    id: String(row.id),
    fingerprint: String(row.fingerprint ?? ""),
    playerId: row.player_id ? String(row.player_id) : null,
    type: String(row.type),
    category: String(row.category) as RiskCategory,
    level: String(row.level) as RiskLevel,
    status: String(row.status) as RiskStatus,
    evidenceSummary: String(row.evidence_summary ?? ""),
    subjectType: row.subject_type ? String(row.subject_type) : null,
    subjectId: row.subject_id ? String(row.subject_id) : null,
    relatedReference: row.related_reference ? String(row.related_reference) : null,
    source: String(row.source ?? "signal"),
    detectedAt: row.detected_at ? String(row.detected_at) : null,
    updatedAt: String(row.updated_at ?? ""),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    resolvedBy: row.resolved_by ? String(row.resolved_by) : null,
    resolveReason: row.resolve_reason ? String(row.resolve_reason) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

export async function listRiskEvents(
  db: AdminDb,
  query: PageQuery & {
    playerId?: string;
    riskId?: string;
    type?: string;
    category?: string;
    level?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  },
) {
  await syncRiskEvents(db);
  return listRiskEventsSafe(db, query);
}

async function listRiskEventsSafe(
  db: AdminDb,
  query: PageQuery & {
    playerId?: string;
    riskId?: string;
    type?: string;
    category?: string;
    level?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  },
) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (query.riskId) {
    where.push("e.id = ?");
    params.push(query.riskId);
  }
  if (query.playerId) {
    where.push("e.player_id = ?");
    params.push(query.playerId);
  }
  if (query.search) {
    where.push("(e.id LIKE ? OR e.player_id LIKE ? OR e.type LIKE ? OR e.evidence_summary LIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like, like, like);
  }
  if (query.type) {
    where.push("e.type = ?");
    params.push(query.type);
  }
  if (query.category) {
    where.push("e.category = ?");
    params.push(query.category);
  }
  if (query.level) {
    where.push("e.level = ?");
    params.push(query.level);
  }
  if (query.status) {
    where.push("e.status = ?");
    params.push(query.status);
  }
  if (query.dateFrom) {
    where.push("COALESCE(e.detected_at, e.created_at) >= ?");
    params.push(query.dateFrom);
  }
  if (query.dateTo) {
    where.push("COALESCE(e.detected_at, e.created_at) <= ?");
    params.push(query.dateTo);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (query.page - 1) * query.pageSize;
  const totalRows = await runRaw<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM admin_risk_events e ${whereSql}`,
    params,
  );
  const rows = await runRaw<Record<string, unknown>>(
    db,
    `
    SELECT * FROM admin_risk_events e
    ${whereSql}
    ORDER BY
      CASE e.level WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
      COALESCE(e.detected_at, e.created_at) DESC
    LIMIT ${Math.floor(query.pageSize)} OFFSET ${Math.floor(offset)}
    `,
    params,
  );
  return {
    total: Number(totalRows[0]?.n ?? 0),
    page: query.page,
    pageSize: query.pageSize,
    items: rows.map(mapRow),
  };
}

export async function getRiskEventDetail(db: AdminDb, riskId: string) {
  await syncRiskEvents(db);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM admin_risk_events WHERE id = ${riskId} LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  const notes = await db.all<Record<string, unknown>>(sql`
    SELECT id, risk_id, admin_id, admin_username, note, created_at
    FROM admin_risk_notes WHERE risk_id = ${riskId}
    ORDER BY created_at ASC
  `);
  const event = mapRow(row);
  return {
    event,
    notes: notes.map((n) => ({
      id: String(n.id),
      adminId: String(n.admin_id),
      adminUsername: String(n.admin_username),
      note: String(n.note),
      createdAt: String(n.created_at),
    })),
    links: {
      playerId: event.playerId,
      roundId: event.subjectType === "round" ? event.subjectId : null,
      spinId: event.subjectType === "round" ? event.subjectId : null,
      ledgerId: event.subjectType === "ledger_transaction" ? event.subjectId : null,
      sessionId: event.subjectType === "game_session" || event.category === "SESSION"
        ? event.subjectType === "player"
          ? null
          : event.subjectId
        : null,
    },
    autoActions: {
      freezePlayer: false,
      freezeBalance: false,
      rejectWithdraw: false,
      mutateLedger: false,
    },
  };
}

export async function updateRiskEventStatus(
  db: AdminDb,
  input: {
    riskId: string;
    status: RiskStatus;
    reason: string;
    adminId: string;
    adminUsername: string;
  },
): Promise<{ ok: true; event: RiskEventRow } | { ok: false; code: string; message: string }> {
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM admin_risk_events WHERE id = ${input.riskId} LIMIT 1
  `);
  const current = rows[0];
  if (!current) return { ok: false, code: "NOT_FOUND", message: "risk event not found" };
  const from = String(current.status) as RiskStatus;
  const to = input.status;
  const allowed =
    (from === "OPEN" && (to === "REVIEWING" || to === "RESOLVED" || to === "DISMISSED")) ||
    (from === "REVIEWING" && (to === "RESOLVED" || to === "DISMISSED" || to === "OPEN"));
  if (!allowed) {
    return { ok: false, code: "INVALID_TRANSITION", message: `${from} → ${to} not allowed` };
  }
  const ts = nowSql();
  const resolved = to === "RESOLVED" || to === "DISMISSED";
  await db.run(sql`
    UPDATE admin_risk_events SET
      status = ${to},
      updated_at = ${ts},
      resolved_at = ${resolved ? ts : null},
      resolved_by = ${resolved ? input.adminUsername : null},
      resolve_reason = ${resolved ? input.reason : current.resolve_reason ?? null}
    WHERE id = ${input.riskId}
  `);
  const after = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM admin_risk_events WHERE id = ${input.riskId} LIMIT 1
  `);
  return { ok: true, event: mapRow(after[0]!) };
}

export async function addRiskNote(
  db: AdminDb,
  input: { riskId: string; note: string; adminId: string; adminUsername: string },
): Promise<{ ok: true; id: string } | { ok: false; code: string; message: string }> {
  const exists = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM admin_risk_events WHERE id = ${input.riskId}
  `);
  if (Number(exists[0]?.n ?? 0) === 0) {
    return { ok: false, code: "NOT_FOUND", message: "risk event not found" };
  }
  const id = crypto.randomUUID();
  await db.run(sql`
    INSERT INTO admin_risk_notes (id, risk_id, admin_id, admin_username, note, created_at)
    VALUES (${id}, ${input.riskId}, ${input.adminId}, ${input.adminUsername}, ${input.note}, ${nowSql()})
  `);
  return { ok: true, id };
}

export async function getRiskPlayerView(db: AdminDb, playerId: string) {
  await syncRiskEvents(db);
  const events = await listRiskEventsSafe(db, {
    page: 1,
    pageSize: 50,
    order: "desc",
    playerId,
  });
  const open = events.items.filter((e) => e.status === "OPEN" || e.status === "REVIEWING");
  const byCat = (cat: RiskCategory) => events.items.filter((e) => e.category === cat);
  const levelRank: Record<RiskLevel, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const maxLevel = open.reduce<RiskLevel>((acc, e) =>
    levelRank[e.level] > levelRank[acc] ? e.level : acc, "LOW");
  const notes = await db.all<Record<string, unknown>>(sql`
    SELECT n.id, n.risk_id, n.admin_username, n.note, n.created_at
    FROM admin_risk_notes n
    JOIN admin_risk_events e ON e.id = n.risk_id
    WHERE e.player_id = ${playerId}
    ORDER BY n.created_at DESC LIMIT 50
  `);
  return {
    playerId,
    riskLevel: open.length === 0 ? "LOW" : maxLevel,
    openEventCount: open.length,
    events: events.items,
    buckets: {
      login: byCat("AUTH"),
      deviceIp: [...byCat("DEVICE"), ...byCat("IP")],
      session: byCat("SESSION"),
      gameplay: byCat("GAMEPLAY"),
      walletLedger: [...byCat("WALLET"), ...byCat("LEDGER")],
      depositWithdrawal: [...byCat("DEPOSIT"), ...byCat("WITHDRAWAL")],
    },
    notes: notes.map((n) => ({
      id: String(n.id),
      riskId: String(n.risk_id),
      adminUsername: String(n.admin_username),
      note: String(n.note),
      createdAt: String(n.created_at),
    })),
  };
}

export async function getRiskOverview(db: AdminDb) {
  const sync = await syncRiskEvents(db);
  const metric = async (label: string, statement: ReturnType<typeof sql>) => {
    try {
      const rows = await db.all<{ n: number }>(statement);
      return { value: Number(rows[0]?.n ?? 0), availability: "OK" as const, source: label };
    } catch (cause) {
      return {
        value: null as number | null,
        availability: "ERROR" as const,
        source: label,
        error: cause instanceof Error ? cause.message : String(cause),
      };
    }
  };

  const todayEvents = await metric(
    "admin_risk_events.detected=today",
    sql`SELECT COUNT(*) AS n FROM admin_risk_events WHERE date(COALESCE(detected_at, created_at)) = date('now')`,
  );
  const openEvents = await metric(
    "admin_risk_events.open|reviewing",
    sql`SELECT COUNT(*) AS n FROM admin_risk_events WHERE status IN ('OPEN','REVIEWING')`,
  );
  const high = await metric(
    "admin_risk_events.HIGH.open",
    sql`SELECT COUNT(*) AS n FROM admin_risk_events WHERE level = 'HIGH' AND status IN ('OPEN','REVIEWING')`,
  );
  const critical = await metric(
    "admin_risk_events.CRITICAL.open",
    sql`SELECT COUNT(*) AS n FROM admin_risk_events WHERE level = 'CRITICAL' AND status IN ('OPEN','REVIEWING')`,
  );
  const loginRisk = await metric(
    "admin_risk_events.AUTH",
    sql`SELECT COUNT(*) AS n FROM admin_risk_events WHERE category = 'AUTH' AND status IN ('OPEN','REVIEWING')`,
  );
  const deviceIp = await metric(
    "admin_risk_events.DEVICE|IP",
    sql`SELECT COUNT(*) AS n FROM admin_risk_events WHERE category IN ('DEVICE','IP') AND status IN ('OPEN','REVIEWING')`,
  );
  const session = await metric(
    "admin_risk_events.SESSION",
    sql`SELECT COUNT(*) AS n FROM admin_risk_events WHERE category = 'SESSION' AND status IN ('OPEN','REVIEWING')`,
  );
  const gameplay = await metric(
    "admin_risk_events.GAMEPLAY",
    sql`SELECT COUNT(*) AS n FROM admin_risk_events WHERE category = 'GAMEPLAY' AND status IN ('OPEN','REVIEWING')`,
  );
  const walletLedger = await metric(
    "admin_risk_events.WALLET|LEDGER",
    sql`SELECT COUNT(*) AS n FROM admin_risk_events WHERE category IN ('WALLET','LEDGER') AND status IN ('OPEN','REVIEWING')`,
  );
  const depositWithdraw = await metric(
    "admin_risk_events.DEPOSIT|WITHDRAWAL",
    sql`SELECT COUNT(*) AS n FROM admin_risk_events WHERE category IN ('DEPOSIT','WITHDRAWAL') AND status IN ('OPEN','REVIEWING')`,
  );

  const recent = await listRiskEventsSafe(db, { page: 1, pageSize: 20, order: "desc" });

  const authFails = await metric(
    "admin_audit_logs.admin.login (success only; failures NOT_AVAILABLE)",
    sql`SELECT COUNT(*) AS n FROM admin_audit_logs WHERE action = 'admin.login' AND date(created_at) = date('now')`,
  );
  const revoked = await metric(
    "admin_audit_logs.session.revoke=today",
    sql`SELECT COUNT(*) AS n FROM admin_audit_logs WHERE action = 'session.revoke' AND date(created_at) = date('now')`,
  );

  const capabilities: Record<RiskCategory, CapabilityState> = {
    AUTH: sync.authCapability ?? "NOT_AVAILABLE",
    SESSION: "IMPLEMENTED",
    DEVICE: "PARTIAL",
    IP: sync.ipCapability ?? "NOT_AVAILABLE",
    GAMEPLAY: "IMPLEMENTED",
    WALLET: "IMPLEMENTED",
    LEDGER: "IMPLEMENTED",
    DEPOSIT: "PARTIAL",
    WITHDRAWAL: "PARTIAL",
    ADMIN_SECURITY: "PARTIAL",
  };

  return {
    metrics: {
      todayEvents,
      openEvents,
      high,
      critical,
      loginRisk,
      deviceIp,
      session,
      gameplay,
      walletLedger,
      depositWithdraw,
    },
    securitySummary: {
      authSuccessLoginsToday: authFails,
      adminAuthFailures: {
        value: null,
        availability: "NOT_AVAILABLE" as const,
        source: "admin failed-login not persisted",
      },
      revokedSessionsToday: revoked,
      highRiskOpen: high,
      criticalOpen: critical,
      moneyIntegrityOpen: walletLedger,
    },
    capabilities,
    recent: recent.items,
    moneyGate: {
      productionMoney: false,
      gate: "CLOSED",
      realMoneyProvider: "NOT_CONFIGURED",
    },
    scannedAt: sync.scannedAt,
    upserted: sync.upserted,
    csvExport: "FUTURE",
  };
}

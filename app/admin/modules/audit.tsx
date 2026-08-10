"use client";

/** ADMIN-1E — Audit Center: admin / game / security (high-risk) — immutable RO. */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DataTable,
  ErrorBox,
  Loading,
  Pagination,
  ReadonlyBanner,
  fmtTime,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type AdminLog = {
  id: string;
  admin_username: string;
  admin_role?: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  reason: string | null;
  ip: string | null;
  request_id?: string | null;
  before_json?: string | null;
  after_json?: string | null;
  created_at: string;
};

type GameLog = {
  id: string;
  actor_type: string | null;
  actor_id: string | null;
  event_type: string | null;
  subject_type: string | null;
  subject_id: string | null;
  created_at: string;
};

type PageResult<T> = {
  total: number;
  pageSize: number;
  items: T[];
  immutable?: boolean;
  export?: string;
  sources?: Record<string, string>;
  availability?: Record<string, string>;
};

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function previewJson(raw: string | null | undefined): string {
  if (!raw) return "-";
  try {
    const parsed = JSON.parse(raw) as unknown;
    const text = JSON.stringify(parsed);
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  } catch {
    return String(raw).slice(0, 80);
  }
}

export default function AuditModule() {
  const { t, api } = useAdmin();
  const tt = t as (k: string) => string;
  const [tab, setTab] = useState<"admin" | "game" | "security">("admin");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [operator, setOperator] = useState("");
  const [action, setAction] = useState("");
  const [targetId, setTargetId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const debouncedSearch = useDebounced(search);
  const debouncedOperator = useDebounced(operator);
  const [adminLogs, setAdminLogs] = useState<PageResult<AdminLog> | null>(null);
  const [gameLogs, setGameLogs] = useState<PageResult<GameLog> | null>(null);
  const [securityLogs, setSecurityLogs] = useState<PageResult<AdminLog> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminLog | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (debouncedOperator) params.set("operator", debouncedOperator);
      if (action) params.set("action", action);
      if (targetId) params.set("targetId", targetId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (tab === "admin") {
        setAdminLogs(await api(`logs/admin?${params}`));
      } else if (tab === "game") {
        if (targetId) params.set("playerId", targetId);
        setGameLogs(await api(`logs/game?${params}`));
      } else {
        setSecurityLogs(await api(`logs/security?${params}`));
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, page, tab, debouncedSearch, debouncedOperator, action, targetId, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const adminColumns: ColumnDef<AdminLog>[] = [
    { key: "created_at", title: t("common.time"), render: (row) => fmtTime(row.created_at) },
    { key: "admin_username", title: tt("audit.operator"), render: (row) => row.admin_username },
    { key: "admin_role", title: tt("audit.role"), render: (row) => row.admin_role ?? "-" },
    { key: "action", title: t("system.action"), render: (row) => <span className="ab-mono">{row.action}</span> },
    {
      key: "target",
      title: t("system.target"),
      render: (row) => `${row.target_type ?? "-"}:${String(row.target_id ?? "").slice(0, 12)}`,
    },
    { key: "reason", title: t("common.reason"), render: (row) => row.reason ?? "-" },
    { key: "ip", title: "IP", render: (row) => <span className="ab-mono">{row.ip ?? "-"}</span> },
    { key: "request_id", title: tt("audit.requestId"), render: (row) => <span className="ab-mono">{row.request_id ? String(row.request_id).slice(0, 10) + "…" : "-"}</span> },
  ];

  const gameColumns: ColumnDef<GameLog>[] = [
    { key: "created_at", title: t("common.time"), render: (row) => fmtTime(row.created_at) },
    {
      key: "event_type",
      title: t("audit.eventType"),
      render: (row) => <span className="ab-mono">{row.event_type ?? "-"}</span>,
    },
    {
      key: "actor",
      title: t("audit.actor"),
      render: (row) => `${row.actor_type ?? "-"}:${String(row.actor_id ?? "").slice(0, 12)}`,
    },
    {
      key: "subject",
      title: t("system.target"),
      render: (row) => `${row.subject_type ?? "-"}:${String(row.subject_id ?? "").slice(0, 12)}`,
    },
  ];

  const current =
    tab === "admin" ? adminLogs : tab === "game" ? gameLogs : securityLogs;

  return (
    <div>
      <ReadonlyBanner text={tt("audit.immutableHint")} />
      <div className="ab-chip" style={{ marginBottom: 12 }}>
        {tt("audit.exportFuture")} · CSV Export = FUTURE
      </div>
      <div className="ab-toolbar">
        <button className={`ab-btn${tab === "admin" ? " primary" : ""}`} onClick={() => { setTab("admin"); setPage(1); }}>
          {t("audit.adminLogs")}
        </button>
        <button className={`ab-btn${tab === "game" ? " primary" : ""}`} onClick={() => { setTab("game"); setPage(1); }}>
          {t("audit.gameLogs")}
        </button>
        <button className={`ab-btn${tab === "security" ? " primary" : ""}`} onClick={() => { setTab("security"); setPage(1); }}>
          {tt("audit.securityLogs")}
        </button>
        <button className="ab-btn" onClick={() => void load()}>⟳ {t("common.refresh")}</button>
      </div>
      <div className="ab-toolbar ab-toolbar-wrap">
        <input className="ab-input" placeholder={t("common.search")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        {tab !== "game" ? (
          <input className="ab-input" placeholder={tt("audit.operator")} value={operator} onChange={(e) => { setOperator(e.target.value); setPage(1); }} />
        ) : null}
        <input className="ab-input" placeholder={tt("audit.actionFilter")} value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
        <input className="ab-input" placeholder="Target / Player ID" value={targetId} onChange={(e) => { setTargetId(e.target.value); setPage(1); }} />
        <input className="ab-input" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        <input className="ab-input" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
      </div>
      {tab === "security" && securityLogs?.availability ? (
        <div className="ab-readonly-banner">
          {Object.entries(securityLogs.availability).map(([k, v]) => (
            <span key={k} style={{ marginRight: 12 }}>
              {k}: <Badge tone={v === "OK" ? "green" : "amber"}>{v}</Badge>
            </span>
          ))}
        </div>
      ) : null}
      {adminLogs?.sources && tab === "admin" ? (
        <div className="ab-chip" style={{ marginBottom: 10 }}>
          {Object.entries(adminLogs.sources).map(([k, v]) => `${k}=${v}`).join(" · ")}
        </div>
      ) : null}
      {error ? <ErrorBox message={error} /> : null}
      {!current ? (
        <Loading text={t("common.loading")} />
      ) : tab === "game" ? (
        <>
          <div className="ab-table-scroll">
            <DataTable columns={gameColumns} rows={gameLogs!.items} empty={t("common.empty")} />
          </div>
          <Pagination page={page} pageSize={gameLogs!.pageSize} total={gameLogs!.total} onPage={setPage} />
        </>
      ) : (
        <>
          <div className="ab-table-scroll">
            <DataTable
              columns={adminColumns}
              rows={(tab === "admin" ? adminLogs!.items : securityLogs!.items)}
              empty={t("common.empty")}
              onRowClick={(row) => setDetail(row)}
            />
          </div>
          <Pagination
            page={page}
            pageSize={(tab === "admin" ? adminLogs!.pageSize : securityLogs!.pageSize)}
            total={(tab === "admin" ? adminLogs!.total : securityLogs!.total)}
            onPage={setPage}
          />
        </>
      )}

      {detail ? (
        <div className="ab-modal-mask" onClick={() => setDetail(null)}>
          <div className="ab-modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="ab-modal-title">
              {tt("audit.detail")} <span className="ab-mono">{detail.id}</span>
            </div>
            <div className="ab-kv" style={{ marginTop: 12 }}>
              <div className="ab-kv-item"><span className="k">{tt("audit.operator")}</span><span className="v">{detail.admin_username}</span></div>
              <div className="ab-kv-item"><span className="k">{tt("audit.role")}</span><span className="v">{detail.admin_role ?? "-"}</span></div>
              <div className="ab-kv-item"><span className="k">{t("system.action")}</span><span className="v ab-mono">{detail.action}</span></div>
              <div className="ab-kv-item"><span className="k">{t("system.target")}</span><span className="v ab-mono">{detail.target_type}:{detail.target_id}</span></div>
              <div className="ab-kv-item"><span className="k">{t("common.reason")}</span><span className="v">{detail.reason ?? "-"}</span></div>
              <div className="ab-kv-item"><span className="k">IP</span><span className="v ab-mono">{detail.ip ?? "-"}</span></div>
              <div className="ab-kv-item"><span className="k">{tt("audit.requestId")}</span><span className="v ab-mono">{detail.request_id ?? "-"}</span></div>
              <div className="ab-kv-item"><span className="k">Before</span><span className="v ab-mono">{previewJson(detail.before_json)}</span></div>
              <div className="ab-kv-item"><span className="k">After</span><span className="v ab-mono">{previewJson(detail.after_json)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("common.time")}</span><span className="v">{fmtTime(detail.created_at)}</span></div>
            </div>
            <div className="ab-chip" style={{ marginTop: 12 }}>{tt("audit.noEditDelete")}</div>
            <div className="ab-modal-actions">
              <button className="ab-btn primary" onClick={() => setDetail(null)}>{t("common.close")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

/** ADMIN-1E — Risk Center: overview, events, player evidence, manual disposition. */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DataTable,
  ErrorBox,
  Loading,
  Pagination,
  ReadonlyBanner,
  StatCard,
  fmtTime,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type MetricCell = {
  value: number | null;
  availability: "OK" | "NOT_AVAILABLE" | "ERROR";
  source?: string;
  error?: string;
};

type RiskEvent = {
  id: string;
  playerId: string | null;
  type: string;
  category: string;
  level: string;
  status: string;
  evidenceSummary: string;
  relatedReference: string | null;
  subjectType: string | null;
  subjectId: string | null;
  detectedAt: string | null;
  updatedAt: string;
};

type Overview = {
  metrics: Record<string, MetricCell>;
  securitySummary: Record<string, MetricCell>;
  capabilities: Record<string, string>;
  recent: RiskEvent[];
  moneyGate: { gate: string; realMoneyProvider: string };
  csvExport: string;
};

type EventDetail = {
  event: RiskEvent & { resolveReason?: string | null; resolvedBy?: string | null };
  notes: { id: string; adminUsername: string; note: string; createdAt: string }[];
  links: { playerId: string | null; roundId: string | null; spinId: string | null; ledgerId: string | null };
};

function levelTone(level: string): "red" | "amber" | "blue" | "gray" {
  if (level === "CRITICAL") return "red";
  if (level === "HIGH") return "amber";
  if (level === "MEDIUM") return "blue";
  return "gray";
}

function levelStatTone(level: string): "ok" | "warn" | "bad" | undefined {
  if (level === "CRITICAL" || level === "HIGH") return "bad";
  if (level === "MEDIUM") return "warn";
  return "ok";
}

function statusTone(status: string): "green" | "amber" | "blue" | "gray" {
  if (status === "RESOLVED") return "green";
  if (status === "REVIEWING") return "amber";
  if (status === "DISMISSED") return "gray";
  return "blue";
}

function Metric({
  label,
  cell,
  t,
}: {
  label: string;
  cell?: MetricCell;
  t: (k: string) => string;
}) {
  if (!cell) return <StatCard label={label} value={t("common.notAvailable")} tone="warn" />;
  if (cell.availability === "ERROR") {
    return <StatCard label={label} value={t("common.unavailable")} tone="bad" sub={cell.error} />;
  }
  if (cell.availability === "NOT_AVAILABLE") {
    return <StatCard label={label} value={t("common.notAvailable")} tone="warn" sub={cell.source} />;
  }
  return <StatCard label={label} value={String(cell.value ?? 0)} tone={(cell.value ?? 0) > 0 ? "bad" : "ok"} />;
}

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function RiskModule({ initialProps }: { initialProps?: Record<string, string> }) {
  const { t, api, toast, openTab, can } = useAdmin();
  const tt = t as (k: string) => string;
  const [tab, setTab] = useState<"overview" | "events" | "player">(
    initialProps?.playerId ? "player" : "overview",
  );
  const [overview, setOverview] = useState<Overview | null>(null);
  const [events, setEvents] = useState<{ total: number; pageSize: number; items: RiskEvent[] } | null>(null);
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState(initialProps?.playerId ?? "");
  const debouncedSearch = useDebounced(search);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [playerView, setPlayerView] = useState<Record<string, unknown> | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const loadOverview = useCallback(async () => {
    setOverview(await api<Overview>("risk/overview"));
  }, [api]);

  const loadEvents = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (level) params.set("level", level);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (debouncedSearch) {
      if (debouncedSearch.includes("-") && debouncedSearch.length > 20) params.set("riskId", debouncedSearch);
      else params.set("playerId", debouncedSearch);
    }
    setEvents(await api(`risk/events?${params}`));
  }, [api, page, level, status, category, debouncedSearch]);

  const loadPlayer = useCallback(async (playerId: string) => {
    setPlayerView(await api(`risk/players/${encodeURIComponent(playerId)}`));
  }, [api]);

  const load = useCallback(async () => {
    try {
      if (tab === "overview") await loadOverview();
      else if (tab === "events") await loadEvents();
      else if (tab === "player" && (search || initialProps?.playerId)) {
        await loadPlayer(search || initialProps!.playerId!);
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [tab, loadOverview, loadEvents, loadPlayer, search, initialProps]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: string) => {
    try {
      setDetail(await api<EventDetail>(`risk/events/${encodeURIComponent(id)}`));
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    }
  };

  const setEventStatus = async (id: string, next: string) => {
    if (!can("risk:manage")) {
      toast(tt("risk.needManage"), true);
      return;
    }
    if (reason.trim().length < 2) {
      toast(t("common.reasonRequired"), true);
      return;
    }
    setBusy(true);
    try {
      await api(`risk/events/${encodeURIComponent(id)}/status`, {
        method: "POST",
        body: { status: next, reason: reason.trim() },
      });
      toast(t("common.success"));
      setReason("");
      await openDetail(id);
      await load();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    } finally {
      setBusy(false);
    }
  };

  const addNote = async (id: string) => {
    if (!can("risk:manage")) return;
    if (note.trim().length < 2) {
      toast(tt("risk.noteRequired"), true);
      return;
    }
    setBusy(true);
    try {
      await api(`risk/events/${encodeURIComponent(id)}/notes`, {
        method: "POST",
        body: { note: note.trim() },
      });
      setNote("");
      await openDetail(id);
      toast(t("common.success"));
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    } finally {
      setBusy(false);
    }
  };

  const eventColumns: ColumnDef<RiskEvent>[] = [
    { key: "id", title: tt("risk.riskId"), render: (r) => <span className="ab-mono">{r.id.slice(0, 10)}…</span> },
    {
      key: "playerId",
      title: tt("risk.relatedPlayer"),
      render: (r) =>
        r.playerId ? (
          <button
            className="ab-btn"
            onClick={(e) => {
              e.stopPropagation();
              openTab({ key: `players:${r.playerId}`, titleKey: "nav.players", props: { playerId: r.playerId! } });
            }}
          >
            <span className="ab-mono">{r.playerId.slice(0, 10)}…</span>
          </button>
        ) : (
          "-"
        ),
    },
    { key: "category", title: tt("risk.category"), render: (r) => <Badge tone="purple">{r.category}</Badge> },
    { key: "type", title: t("risk.signalType"), render: (r) => <span className="ab-mono">{r.type}</span> },
    { key: "level", title: t("risk.level"), render: (r) => <Badge tone={levelTone(r.level)}>{r.level}</Badge> },
    { key: "status", title: t("common.status"), render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: "evidenceSummary", title: t("risk.evidence"), render: (r) => r.evidenceSummary.slice(0, 72) },
    { key: "detectedAt", title: t("risk.detectedAt"), render: (r) => fmtTime(r.detectedAt) },
  ];

  return (
    <div>
      <ReadonlyBanner text={tt("risk.readonlyWorkflowHint")} />
      <div className="ab-money-gate-banner" role="status">
        <div><b>{tt("money.realProvider")}:</b> {overview?.moneyGate.realMoneyProvider ?? tt("money.notConfigured")}</div>
        <div><b>{tt("money.productionMoney")}:</b> {tt("money.gateClosed")}</div>
        <div>{tt("risk.noAutoAction")}</div>
      </div>
      <div className="ab-toolbar">
        {(["overview", "events", "player"] as const).map((key) => (
          <button
            key={key}
            className={`ab-btn${tab === key ? " primary" : ""}`}
            onClick={() => setTab(key)}
          >
            {tt(`risk.tab.${key}`)}
          </button>
        ))}
        <button className="ab-btn" onClick={() => void load()}>⟳ {t("common.refresh")}</button>
      </div>
      {error ? <ErrorBox message={error} /> : null}

      {tab === "overview" ? (
        !overview ? (
          <Loading text={t("common.loading")} />
        ) : (
          <>
            <div className="ab-stat-grid">
              <Metric label={tt("risk.todayEvents")} cell={overview.metrics.todayEvents} t={tt} />
              <Metric label={tt("risk.openEvents")} cell={overview.metrics.openEvents} t={tt} />
              <Metric label={t("risk.levelHigh")} cell={overview.metrics.high} t={tt} />
              <Metric label={t("risk.levelCritical")} cell={overview.metrics.critical} t={tt} />
              <Metric label={tt("risk.loginRisk")} cell={overview.metrics.loginRisk} t={tt} />
              <Metric label={tt("risk.deviceIpRisk")} cell={overview.metrics.deviceIp} t={tt} />
              <Metric label={tt("risk.sessionRisk")} cell={overview.metrics.session} t={tt} />
              <Metric label={tt("risk.gameplayRisk")} cell={overview.metrics.gameplay} t={tt} />
              <Metric label={tt("risk.walletLedgerRisk")} cell={overview.metrics.walletLedger} t={tt} />
              <Metric label={tt("risk.depositWithdrawRisk")} cell={overview.metrics.depositWithdraw} t={tt} />
            </div>
            <div className="ab-panel" style={{ marginTop: 12 }}>
              <div className="ab-panel-title">{tt("risk.capabilities")}</div>
              <div className="ab-kv">
                {Object.entries(overview.capabilities).map(([k, v]) => (
                  <div className="ab-kv-item" key={k}>
                    <span className="k">{k}</span>
                    <span className="v"><Badge tone={v === "IMPLEMENTED" ? "green" : v === "PARTIAL" ? "amber" : "gray"}>{v}</Badge></span>
                  </div>
                ))}
              </div>
            </div>
            <div className="ab-panel-title" style={{ marginTop: 16 }}>{tt("risk.recentEvents")}</div>
            <div className="ab-table-scroll">
              <DataTable
                columns={eventColumns}
                rows={overview.recent}
                empty={t("common.empty")}
                onRowClick={(row) => void openDetail(row.id)}
              />
            </div>
          </>
        )
      ) : null}

      {tab === "events" ? (
        <>
          <div className="ab-toolbar ab-toolbar-wrap">
            <input
              className="ab-input"
              placeholder={`${tt("risk.riskId")} / Player`}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            <select className="ab-select" value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}>
              <option value="">{t("risk.allLevels")}</option>
              {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select className="ab-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">{t("common.all")} / Status</option>
              {["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="ab-select" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
              <option value="">{t("common.all")} / Category</option>
              {["AUTH", "SESSION", "DEVICE", "IP", "GAMEPLAY", "WALLET", "LEDGER", "DEPOSIT", "WITHDRAWAL", "ADMIN_SECURITY"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {!events ? (
            <Loading text={t("common.loading")} />
          ) : (
            <>
              <div className="ab-table-scroll">
                <DataTable columns={eventColumns} rows={events.items} empty={t("common.empty")} onRowClick={(r) => void openDetail(r.id)} />
              </div>
              <Pagination page={page} pageSize={events.pageSize} total={events.total} onPage={setPage} />
            </>
          )}
        </>
      ) : null}

      {tab === "player" ? (
        <>
          <div className="ab-toolbar">
            <input
              className="ab-input"
              placeholder={tt("risk.relatedPlayer")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="ab-btn primary" onClick={() => search && void loadPlayer(search)}>{t("common.search")}</button>
          </div>
          {!playerView ? (
            <div className="ab-chip">{tt("risk.playerHint")}</div>
          ) : (
            <>
              <div className="ab-stat-grid">
                <StatCard label={tt("risk.playerRiskLevel")} value={String(playerView.riskLevel)} tone={levelStatTone(String(playerView.riskLevel))} />
                <StatCard label={tt("risk.openEvents")} value={String(playerView.openEventCount ?? 0)} />
              </div>
              <div className="ab-toolbar">
                <button className="ab-btn" onClick={() => openTab({ key: `players:${playerView.playerId}`, titleKey: "nav.players", props: { playerId: String(playerView.playerId) } })}>
                  Player Detail
                </button>
                <button className="ab-btn" onClick={() => openTab({ key: `wallet:${playerView.playerId}`, titleKey: "nav.wallet", props: { playerId: String(playerView.playerId) } })}>
                  Wallet
                </button>
                <button className="ab-btn" onClick={() => openTab({ key: `ledger:p:${playerView.playerId}`, titleKey: "nav.ledger", props: { playerId: String(playerView.playerId) } })}>
                  Ledger
                </button>
              </div>
              <DataTable
                columns={eventColumns}
                rows={(playerView.events as RiskEvent[]) ?? []}
                empty={t("common.empty")}
                onRowClick={(r) => void openDetail(r.id)}
              />
            </>
          )}
        </>
      ) : null}

      {detail ? (
        <div className="ab-modal-mask" onClick={() => setDetail(null)}>
          <div className="ab-modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="ab-modal-title">
              {tt("risk.eventDetail")} <span className="ab-mono">{detail.event.id}</span>
            </div>
            <div className="ab-kv" style={{ marginTop: 12 }}>
              <div className="ab-kv-item"><span className="k">{t("risk.level")}</span><span className="v"><Badge tone={levelTone(detail.event.level)}>{detail.event.level}</Badge></span></div>
              <div className="ab-kv-item"><span className="k">{t("common.status")}</span><span className="v"><Badge tone={statusTone(detail.event.status)}>{detail.event.status}</Badge></span></div>
              <div className="ab-kv-item"><span className="k">{tt("risk.category")}</span><span className="v">{detail.event.category}</span></div>
              <div className="ab-kv-item"><span className="k">{t("risk.signalType")}</span><span className="v ab-mono">{detail.event.type}</span></div>
              <div className="ab-kv-item"><span className="k">{t("risk.evidence")}</span><span className="v">{detail.event.evidenceSummary}</span></div>
              <div className="ab-kv-item"><span className="k">{tt("risk.reference")}</span><span className="v ab-mono">{detail.event.relatedReference ?? "-"}</span></div>
            </div>
            <div className="ab-toolbar" style={{ marginTop: 12 }}>
              {detail.links.playerId ? (
                <button className="ab-btn" onClick={() => { setDetail(null); openTab({ key: `players:${detail.links.playerId}`, titleKey: "nav.players", props: { playerId: detail.links.playerId! } }); }}>Player</button>
              ) : null}
              {detail.links.roundId ? (
                <button className="ab-btn" onClick={() => { setDetail(null); openTab({ key: `rounds:${detail.links.roundId}`, titleKey: "nav.rounds", props: { roundId: detail.links.roundId! } }); }}>Round</button>
              ) : null}
              {detail.links.spinId ? (
                <button className="ab-btn" onClick={() => { setDetail(null); openTab({ key: `spins:${detail.links.spinId}`, titleKey: "nav.spins", props: { spinId: detail.links.spinId! } }); }}>Spin</button>
              ) : null}
              {detail.links.ledgerId ? (
                <button className="ab-btn" onClick={() => { setDetail(null); openTab({ key: `ledger:${detail.links.ledgerId}`, titleKey: "nav.ledger", props: { transactionId: detail.links.ledgerId! } }); }}>Ledger</button>
              ) : null}
            </div>
            {can("risk:manage") ? (
              <>
                <div className="ab-field" style={{ marginTop: 12 }}>
                  <label>{t("common.reason")}</label>
                  <input className="ab-input" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <div className="ab-toolbar">
                  {detail.event.status === "OPEN" ? (
                    <button className="ab-btn" disabled={busy} onClick={() => void setEventStatus(detail.event.id, "REVIEWING")}>{tt("risk.markReviewing")}</button>
                  ) : null}
                  {["OPEN", "REVIEWING"].includes(detail.event.status) ? (
                    <>
                      <button className="ab-btn primary" disabled={busy} onClick={() => void setEventStatus(detail.event.id, "RESOLVED")}>{tt("risk.markResolved")}</button>
                      <button className="ab-btn" disabled={busy} onClick={() => void setEventStatus(detail.event.id, "DISMISSED")}>{tt("risk.markDismissed")}</button>
                    </>
                  ) : null}
                </div>
                <div className="ab-field" style={{ marginTop: 12 }}>
                  <label>{tt("risk.addNote")}</label>
                  <input className="ab-input" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <button className="ab-btn" disabled={busy} onClick={() => void addNote(detail.event.id)}>{tt("risk.saveNote")}</button>
              </>
            ) : (
              <div className="ab-chip">{tt("risk.viewOnlyDisposition")}</div>
            )}
            <div className="ab-panel-title" style={{ marginTop: 16 }}>{tt("risk.notes")}</div>
            {detail.notes.length === 0 ? (
              <div className="ab-chip">{t("common.empty")}</div>
            ) : (
              detail.notes.map((n) => (
                <div key={n.id} className="ab-panel" style={{ marginBottom: 8 }}>
                  <div className="ab-mono" style={{ fontSize: 12 }}>{n.adminUsername} · {fmtTime(n.createdAt)}</div>
                  <div>{n.note}</div>
                </div>
              ))
            )}
            <div className="ab-modal-actions">
              <button className="ab-btn primary" onClick={() => setDetail(null)}>{t("common.close")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

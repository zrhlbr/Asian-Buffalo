"use client";

/** ADMIN-1D — Ledger Center: list/detail/search + Player↔Round↔Spin↔Ledger links. */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DataTable,
  ErrorBox,
  Loading,
  Pagination,
  ReadonlyBanner,
  StatCard,
  fmtMinor,
  fmtTime,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type View = "accounts" | "transactions" | "entries" | "balances" | "health";

type Row = Record<string, unknown> & { id?: string };

type HealthData = {
  ok?: boolean;
  unbalancedTx?: number;
  projectionMismatch?: number;
  checkedTx?: number;
  unbalancedIds?: string[];
  mismatchAccountIds?: string[];
  total?: number;
  pageSize?: number;
  items?: Row[];
};

type LedgerDetail = {
  ledgerId: string;
  playerId: string | null;
  walletId: string | null;
  currency: string | null;
  type: string;
  direction: string;
  amountMinor: number;
  balanceBeforeMinor: number | null;
  balanceAfterMinor: number | null;
  referenceType: string;
  referenceId: string;
  createdAt: string;
  status: string;
  idempotencyKey: string;
  requestHash: string;
  entries: Record<string, unknown>[];
  reconciliation: { status: string; entrySumMinor: number; playerCheck: string; rule: string };
  round: Record<string, unknown> | null;
  spin: { id: string | null; aliasOf: string; note: string } | null;
  links: { playerId: string | null; roundId: string | null; spinId: string | null; ledgerId: string };
};

const TX_STATUSES = ["PENDING", "POSTED", "REVERSED"];
const TX_KINDS = ["GAME_BET", "GAME_PAYOUT", "REVERSAL", "ADJUSTMENT", "DEPOSIT", "WITHDRAWAL"];

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export default function LedgerModule({ initialProps }: { initialProps?: Record<string, string> }) {
  const { t, api, toast, openTab } = useAdmin();
  const tt = t as (k: string) => string;
  const [view, setView] = useState<View>(initialProps?.transactionId ? "transactions" : "transactions");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(initialProps?.playerId ?? "");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [direction, setDirection] = useState("");
  const [currency, setCurrency] = useState("");
  const [roundId, setRoundId] = useState("");
  const [referenceId, setReferenceId] = useState(initialProps?.transactionId ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [txFilter, setTxFilter] = useState(initialProps?.transactionId ?? "");
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<LedgerDetail | null>(null);
  const debouncedSearch = useDebounced(search, 350);

  useEffect(() => {
    if (initialProps?.transactionId) {
      setView("transactions");
      setReferenceId(initialProps.transactionId);
      void openDetail(initialProps.transactionId);
    }
    if (initialProps?.playerId) {
      setSearch(initialProps.playerId);
      setView("transactions");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProps?.transactionId, initialProps?.playerId]);

  const load = useCallback(async () => {
    try {
      if (view === "health") {
        setData(await api("ledger/health"));
      } else {
        const params = new URLSearchParams({ page: String(page), pageSize: "20" });
        if (view === "transactions") {
          if (debouncedSearch) params.set("playerId", debouncedSearch);
          if (status) params.set("status", status);
          if (kind) params.set("kind", kind);
          if (direction) params.set("direction", direction);
          if (currency) params.set("currency", currency);
          if (roundId) params.set("roundId", roundId);
          if (referenceId) params.set("referenceId", referenceId);
          if (dateFrom) params.set("dateFrom", dateFrom);
          if (dateTo) params.set("dateTo", dateTo);
        } else if (view === "entries") {
          if (txFilter) params.set("transactionId", txFilter);
          else if (debouncedSearch) params.set("search", debouncedSearch);
        } else if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }
        if (view === "accounts" && status) params.set("status", status);
        setData(await api(`ledger/${view}?${params}`));
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, page, txFilter, view, debouncedSearch, status, kind, direction, currency, roundId, referenceId, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: string) => {
    try {
      setDetail(await api<LedgerDetail>(`ledger/transactions/${encodeURIComponent(id)}`));
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    }
  };

  const accountColumns: ColumnDef<Row>[] = [
    { key: "id", title: t("ledger.account"), render: (row) => <span className="ab-mono">{String(row.id ?? "").slice(0, 12)}…</span> },
    { key: "kind", title: t("ledger.kind"), render: (row) => <Badge tone="purple">{String(row.kind ?? "")}</Badge> },
    { key: "player_id", title: tt("wallet.playerId"), render: (row) => row.player_id ? <span className="ab-mono">{String(row.player_id).slice(0, 10)}…</span> : "-" },
    { key: "currency", title: t("common.currency"), render: (row) => String(row.currency ?? "") },
    { key: "balance_minor", title: t("common.balance"), render: (row) => `${fmtMinor(Number(row.balance_minor ?? 0))} ${String(row.currency ?? "")}` },
    { key: "version", title: t("ledger.version"), render: (row) => String(row.version ?? "") },
  ];

  const txColumns: ColumnDef<Row>[] = [
    { key: "id", title: tt("ledger.ledgerId"), render: (row) => <span className="ab-mono">{String(row.id ?? "").slice(0, 12)}…</span> },
    { key: "player_id", title: tt("wallet.playerId"), render: (row) => row.player_id ? <span className="ab-mono">{String(row.player_id).slice(0, 10)}…</span> : "-" },
    { key: "currency", title: t("common.currency"), render: (row) => String(row.currency ?? "-") },
    { key: "kind", title: t("ledger.kind"), render: (row) => (
      <Badge tone={String(row.kind) === "REVERSAL" ? "amber" : "purple"}>{String(row.kind ?? "")}</Badge>
    ) },
    {
      key: "amount_minor",
      title: t("common.amount"),
      render: (row) => (
        <span className="ab-money">{fmtMinor(Number(row.amount_minor ?? 0))} {String(row.currency ?? "")}</span>
      ),
    },
    { key: "direction", title: t("wallet.direction"), render: (row) => <Badge tone={row.direction === "DEBIT" ? "amber" : "green"}>{String(row.direction ?? "")}</Badge> },
    { key: "balance_before_minor", title: tt("ledger.balanceBefore"), render: (row) => row.balance_before_minor == null ? "-" : fmtMinor(Number(row.balance_before_minor)) },
    { key: "balance_after_minor", title: t("ledger.balanceAfter"), render: (row) => row.balance_after_minor == null ? "-" : fmtMinor(Number(row.balance_after_minor)) },
    { key: "reference_type", title: tt("ledger.referenceType"), render: (row) => String(row.reference_type ?? "-") },
    { key: "reference_id", title: tt("ledger.referenceId"), render: (row) => <span className="ab-mono">{String(row.reference_id ?? "").slice(0, 10)}…</span> },
    { key: "status", title: t("common.status"), render: (row) => (
      <Badge tone={row.status === "POSTED" ? "green" : row.status === "REVERSED" ? "amber" : "gray"}>
        {String(row.status ?? "")}
      </Badge>
    ) },
    { key: "created_at", title: t("common.time"), render: (row) => fmtTime(String(row.created_at ?? "")) },
  ];

  const entryColumns: ColumnDef<Row>[] = [
    { key: "id", title: "Entry", render: (row) => <span className="ab-mono">{String(row.id ?? "").slice(0, 10)}…</span> },
    { key: "transaction_id", title: "Tx", render: (row) => <span className="ab-mono">{String(row.transaction_id ?? "").slice(0, 10)}…</span> },
    { key: "account_id", title: t("ledger.account"), render: (row) => <span className="ab-mono">{String(row.account_id ?? "").slice(0, 10)}…</span> },
    { key: "amount_minor", title: t("common.amount"), render: (row) => fmtMinor(Number(row.amount_minor ?? 0)) },
    { key: "balance_after_minor", title: t("ledger.balanceAfter"), render: (row) => fmtMinor(Number(row.balance_after_minor ?? 0)) },
    { key: "sequence", title: t("ledger.sequence"), render: (row) => String(row.sequence ?? "") },
  ];

  const balColumns: ColumnDef<Row>[] = [
    { key: "account_id", title: t("ledger.account"), render: (row) => <span className="ab-mono">{String(row.account_id ?? row.id ?? "").slice(0, 12)}…</span> },
    { key: "kind", title: t("ledger.kind"), render: (row) => String(row.kind ?? "") },
    { key: "balance_minor", title: t("common.balance"), render: (row) => fmtMinor(Number(row.balance_minor ?? 0)) },
    { key: "currency", title: t("common.currency"), render: (row) => String(row.currency ?? "") },
  ];

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Loading text={t("common.loading")} />;

  return (
    <div>
      <ReadonlyBanner text={t("ledger.readonlyHint")} />
      <div className="ab-money-gate-banner" role="status">
        <div><b>{tt("money.realProvider")}:</b> {tt("money.notConfigured")}</div>
        <div><b>{tt("money.productionMoney")}:</b> {tt("money.gateClosed")}</div>
      </div>
      <div className="ab-toolbar">
        {(["health", "accounts", "transactions", "entries", "balances"] as View[]).map((key) => (
          <button
            key={key}
            className={`ab-btn${view === key ? " primary" : ""}`}
            onClick={() => { setView(key); setPage(1); }}
          >
            {t(`ledger.${key}` as never)}
          </button>
        ))}
        <button className="ab-btn" onClick={() => void load()}>⟳ {t("common.refresh")}</button>
      </div>

      {view === "health" ? (
        <>
          <div className="ab-stat-grid">
            <StatCard label={t("ledger.health")} value={data.ok ? t("ledger.healthOk") : t("ledger.healthIssues")} tone={data.ok ? "ok" : "bad"} />
            <StatCard label={t("ledger.unbalancedTx")} value={String(data.unbalancedTx ?? 0)} tone={(data.unbalancedTx ?? 0) > 0 ? "bad" : "ok"} />
            <StatCard label={t("ledger.projectionMismatch")} value={String(data.projectionMismatch ?? 0)} tone={(data.projectionMismatch ?? 0) > 0 ? "bad" : "ok"} />
            <StatCard label={t("ledger.checkedTx")} value={String(data.checkedTx ?? 0)} />
          </div>
          {(data.unbalancedIds?.length || data.mismatchAccountIds?.length) ? (
            <div className="ab-panel" style={{ marginTop: 12 }}>
              <div className="ab-panel-title">{t("ledger.healthIds")}</div>
              <div className="ab-kv">
                <div className="ab-kv-item">
                  <span className="k">{t("ledger.unbalancedTx")}</span>
                  <span className="v ab-mono">{(data.unbalancedIds ?? []).join(", ") || "-"}</span>
                </div>
                <div className="ab-kv-item">
                  <span className="k">{t("ledger.projectionMismatch")}</span>
                  <span className="v ab-mono">{(data.mismatchAccountIds ?? []).join(", ") || "-"}</span>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="ab-toolbar ab-toolbar-wrap">
            <input
              className="ab-input"
              placeholder={view === "entries" ? "transactionId" : view === "transactions" ? tt("ledger.searchPlayer") : t("common.search")}
              value={view === "entries" ? txFilter || search : search}
              onChange={(e) => {
                if (view === "entries") {
                  setTxFilter(e.target.value);
                  setSearch(e.target.value);
                } else {
                  setSearch(e.target.value);
                }
                setPage(1);
              }}
            />
            {view === "transactions" ? (
              <>
                <input className="ab-input" placeholder="Round / Spin ID" value={roundId} onChange={(e) => { setRoundId(e.target.value); setPage(1); }} />
                <input className="ab-input" placeholder={tt("ledger.referenceId")} value={referenceId} onChange={(e) => { setReferenceId(e.target.value); setPage(1); }} />
                <select className="ab-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                  <option value="">{t("common.all")} / {t("common.status")}</option>
                  {TX_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="ab-select" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}>
                  <option value="">{t("common.all")} / {t("ledger.kind")}</option>
                  {TX_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <select className="ab-select" value={direction} onChange={(e) => { setDirection(e.target.value); setPage(1); }}>
                  <option value="">{t("common.all")} / Direction</option>
                  <option value="DEBIT">DEBIT</option>
                  <option value="CREDIT">CREDIT</option>
                </select>
                <select className="ab-select" value={currency} onChange={(e) => { setCurrency(e.target.value); setPage(1); }}>
                  <option value="">{t("common.all")} / Currency</option>
                  <option value="MMK">MMK</option>
                  <option value="USDT">USDT</option>
                </select>
                <input className="ab-input" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
                <input className="ab-input" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
              </>
            ) : null}
          </div>
          <div className="ab-table-scroll">
            <DataTable
              columns={
                view === "accounts" ? accountColumns
                  : view === "transactions" ? txColumns
                    : view === "entries" ? entryColumns
                      : balColumns
              }
              rows={(data.items ?? []) as Row[]}
              empty={t("common.empty")}
              onRowClick={view === "transactions" ? (row) => void openDetail(String(row.id)) : undefined}
            />
          </div>
          {typeof data.total === "number" && typeof data.pageSize === "number" ? (
            <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          ) : null}
        </>
      )}

      {detail ? (
        <div className="ab-modal-mask" onClick={() => setDetail(null)}>
          <div className="ab-modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="ab-modal-title">
              {tt("ledger.detail")} <span className="ab-mono">{detail.ledgerId}</span>
            </div>
            <div className="ab-kv" style={{ marginTop: 12 }}>
              <div className="ab-kv-item"><span className="k">{tt("wallet.playerId")}</span><span className="v ab-mono">{detail.playerId ?? "-"}</span></div>
              <div className="ab-kv-item"><span className="k">{tt("wallet.walletId")}</span><span className="v ab-mono">{detail.walletId ?? "-"}</span></div>
              <div className="ab-kv-item"><span className="k">{t("common.currency")}</span><span className="v">{detail.currency ?? "-"}</span></div>
              <div className="ab-kv-item"><span className="k">{t("ledger.kind")}</span><span className="v">{detail.type}</span></div>
              <div className="ab-kv-item"><span className="k">{t("wallet.direction")}</span><span className="v">{detail.direction}</span></div>
              <div className="ab-kv-item"><span className="k">{t("common.amount")}</span><span className="v ab-money">{fmtMinor(detail.amountMinor)} {detail.currency}</span></div>
              <div className="ab-kv-item"><span className="k">{tt("ledger.balanceBefore")}</span><span className="v">{detail.balanceBeforeMinor == null ? "-" : fmtMinor(detail.balanceBeforeMinor)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("ledger.balanceAfter")}</span><span className="v">{detail.balanceAfterMinor == null ? "-" : fmtMinor(detail.balanceAfterMinor)}</span></div>
              <div className="ab-kv-item"><span className="k">{tt("ledger.referenceType")}</span><span className="v">{detail.referenceType}</span></div>
              <div className="ab-kv-item"><span className="k">{tt("ledger.referenceId")}</span><span className="v ab-mono">{detail.referenceId}</span></div>
              <div className="ab-kv-item"><span className="k">{t("common.status")}</span><span className="v"><Badge tone={detail.status === "POSTED" ? "green" : "gray"}>{detail.status}</Badge></span></div>
              <div className="ab-kv-item"><span className="k">{t("ledger.idempotencyKey")}</span><span className="v ab-mono">{detail.idempotencyKey}</span></div>
              <div className="ab-kv-item"><span className="k">{tt("ledger.reconStatus")}</span><span className="v"><Badge tone={detail.reconciliation.status === "MATCH" ? "green" : "red"}>{detail.reconciliation.status}</Badge> / player {detail.reconciliation.playerCheck}</span></div>
              <div className="ab-kv-item"><span className="k">{t("common.createdAt")}</span><span className="v">{fmtTime(detail.createdAt)}</span></div>
            </div>
            <div className="ab-panel-title" style={{ marginTop: 16 }}>{tt("ledger.traceLinks")}</div>
            <div className="ab-toolbar">
              {detail.links.playerId ? (
                <button className="ab-btn" onClick={() => { setDetail(null); openTab({ key: `players:${detail.links.playerId}`, titleKey: "nav.players", props: { playerId: detail.links.playerId! } }); }}>Player</button>
              ) : null}
              {detail.links.roundId ? (
                <button className="ab-btn" onClick={() => { setDetail(null); openTab({ key: `rounds:${detail.links.roundId}`, titleKey: "nav.rounds", props: { roundId: detail.links.roundId! } }); }}>Round</button>
              ) : null}
              {detail.links.spinId ? (
                <button className="ab-btn" onClick={() => { setDetail(null); openTab({ key: `spins:${detail.links.spinId}`, titleKey: "nav.spins", props: { spinId: detail.links.spinId! } }); }}>Spin</button>
              ) : null}
              {detail.links.playerId ? (
                <button className="ab-btn" onClick={() => { setDetail(null); openTab({ key: `wallet:${detail.links.playerId}`, titleKey: "nav.wallet", props: { playerId: detail.links.playerId! } }); }}>Wallet</button>
              ) : null}
            </div>
            <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("ledger.entries")}</div>
            <DataTable
              columns={[
                { key: "sequence", title: t("ledger.sequence"), render: (row) => String(row.sequence ?? "") },
                { key: "accountKind", title: t("ledger.kind"), render: (row) => String(row.accountKind ?? "") },
                { key: "amountMinor", title: t("common.amount"), render: (row) => fmtMinor(Number(row.amountMinor ?? 0)) },
                { key: "balanceBeforeMinor", title: tt("ledger.balanceBefore"), render: (row) => fmtMinor(Number(row.balanceBeforeMinor ?? 0)) },
                { key: "balanceAfterMinor", title: t("ledger.balanceAfter"), render: (row) => fmtMinor(Number(row.balanceAfterMinor ?? 0)) },
              ]}
              rows={detail.entries}
              empty={t("common.empty")}
            />
            <div className="ab-modal-actions">
              <button className="ab-btn primary" onClick={() => setDetail(null)}>{t("common.close")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

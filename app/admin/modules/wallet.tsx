"use client";

/** ADMIN-1D — Wallet Center: balances (Total/Available/Frozen) + intents + integrity. */

import React, { useCallback, useEffect, useMemo, useState } from "react";
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

type View = "balances" | "intents" | "ops" | "integrity";

type BalanceRow = {
  playerId: string;
  walletId: string | null;
  currency: string;
  availableMinor: number;
  frozenMinor: number;
  totalMinor: number;
  status: string;
  playerStatus: string;
  updatedAt: string | null;
  createdAt: string | null;
};

type IntentRow = {
  id: string;
  player_id: string;
  idempotency_key: string;
  operation: string;
  status: string;
  currency: string;
  amount_minor: number;
  provider_op_id: string | null;
  ledger_tx_id: string | null;
  error_code: string | null;
  created_at: string;
  [key: string]: unknown;
};

type OpRow = {
  id: string;
  intent_id: string;
  idempotency_key: string;
  status: string;
  currency: string;
  amount_minor: number;
  direction: string;
  created_at: string;
  [key: string]: unknown;
};

type IntentDetail = {
  intent: Record<string, unknown>;
  providerOps: Record<string, unknown>[];
  timeline: { at: string; stage: string; status: string; ref: string }[];
};

type WalletDetail = {
  playerId: string;
  walletId: string | null;
  walletAdapterRef: string;
  currency: string;
  availableMinor: number;
  frozenMinor: number;
  totalMinor: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  source: Record<string, string>;
  accounts: Record<string, unknown>[];
  recentLedger: Record<string, unknown>[];
  recentIntents: Record<string, unknown>[];
};

type IntegrityItem = {
  code: string;
  severity: string;
  playerId?: string | null;
  currency?: string | null;
  subjectType: string;
  subjectId: string;
  message: string;
};

const INTENT_STATUSES = ["NEW", "LOCKED", "PROCESSING", "SUCCESS", "FAILED", "UNKNOWN", "RECOVERED"];
const OP_STATUSES = ["NEW", "PROCESSING", "SUCCESS", "SETTLED", "FAILED", "UNKNOWN", "RECOVER"];
const OPERATIONS = ["DEBIT", "CREDIT", "SETTLE", "ROLLBACK"];

function statusTone(status: string): "green" | "red" | "amber" | "blue" | "gray" | "purple" {
  if (status === "SUCCESS" || status === "SETTLED" || status === "RECOVERED" || status === "POSTED" || status === "ACTIVE") return "green";
  if (status === "FAILED" || status === "UNKNOWN" || status === "CLOSED" || status === "CRITICAL") return "red";
  if (status === "PROCESSING" || status === "LOCKED" || status === "RECOVER" || status === "FROZEN_HOLDS" || status === "HIGH") return "amber";
  return "blue";
}

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export default function WalletModule({ initialProps }: { initialProps?: Record<string, string> }) {
  const { t, api, toast, openTab, can } = useAdmin();
  const tt = t as (k: string) => string;
  const [view, setView] = useState<View>(initialProps?.playerId ? "balances" : "balances");
  const [search, setSearch] = useState(initialProps?.playerId ?? initialProps?.intentId ?? "");
  const debouncedSearch = useDebounced(search, 350);
  const [status, setStatus] = useState("");
  const [currency, setCurrency] = useState("");
  const [operation, setOperation] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; pageSize: number; items: unknown[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intentDetail, setIntentDetail] = useState<IntentDetail | null>(null);
  const [walletDetail, setWalletDetail] = useState<WalletDetail | null>(null);
  const [integrity, setIntegrity] = useState<{ items: IntegrityItem[]; scannedAt: string } | null>(null);

  const load = useCallback(async () => {
    try {
      if (view === "integrity") {
        if (!can("wallet:integrity:view")) {
          setError("FORBIDDEN");
          setIntegrity(null);
          return;
        }
        const result = await api<{ items: IntegrityItem[]; scannedAt: string }>("wallet/integrity?limit=100");
        setIntegrity(result);
        setData({ total: result.items.length, pageSize: 100, items: result.items });
      } else if (view === "balances") {
        const params = new URLSearchParams({ page: String(page), pageSize: "20" });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (status) params.set("status", status);
        if (currency) params.set("currency", currency);
        setData(await api(`wallet/balances?${params}`));
      } else {
        const params = new URLSearchParams({ page: String(page), pageSize: "20" });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (status) params.set("status", status);
        if (operation && view === "intents") params.set("operation", operation);
        setData(await api(`wallet/${view === "intents" ? "intents" : "provider-ops"}?${params}`));
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, page, debouncedSearch, status, operation, view, currency, can]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (initialProps?.intentId) {
      void openIntent(initialProps.intentId);
    }
    if (initialProps?.playerId) {
      void openWallet(initialProps.playerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProps?.intentId, initialProps?.playerId]);

  const openIntent = async (id: string) => {
    try {
      setIntentDetail(await api<IntentDetail>(`wallet/intents/${encodeURIComponent(id)}`));
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    }
  };

  const openWallet = async (playerId: string) => {
    try {
      setWalletDetail(await api<WalletDetail>(`wallet/players/${encodeURIComponent(playerId)}`));
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    }
  };

  const balanceColumns: ColumnDef<BalanceRow>[] = useMemo(
    () => [
      {
        key: "playerId",
        title: tt("wallet.playerId"),
        render: (row) => <span className="ab-mono">{row.playerId.slice(0, 12)}…</span>,
      },
      { key: "currency", title: t("common.currency") },
      {
        key: "totalMinor",
        title: tt("wallet.totalBalance"),
        render: (row) => (
          <span className="ab-money">
            {fmtMinor(row.totalMinor)} <span className="ab-chip">{row.currency}</span>
          </span>
        ),
      },
      {
        key: "availableMinor",
        title: tt("wallet.availableBalance"),
        render: (row) => (
          <span className="ab-money">
            {fmtMinor(row.availableMinor)} {row.currency}
          </span>
        ),
      },
      {
        key: "frozenMinor",
        title: tt("wallet.frozenBalance"),
        render: (row) => (
          <span className="ab-money">
            {fmtMinor(row.frozenMinor)} {row.currency}
          </span>
        ),
      },
      {
        key: "status",
        title: t("common.status"),
        render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>,
      },
      {
        key: "updatedAt",
        title: tt("wallet.lastUpdated"),
        render: (row) => fmtTime(row.updatedAt),
      },
    ],
    [t, tt],
  );

  const intentColumns: ColumnDef<IntentRow>[] = [
    { key: "id", title: "Intent", render: (row) => <span className="ab-mono">{row.id.slice(0, 10)}…</span> },
    { key: "player_id", title: tt("wallet.playerId"), render: (row) => <span className="ab-mono">{row.player_id.slice(0, 10)}…</span> },
    { key: "operation", title: t("wallet.operation"), render: (row) => <Badge tone="purple">{row.operation}</Badge> },
    { key: "status", title: t("common.status"), render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    { key: "amount_minor", title: t("common.amount"), render: (row) => `${fmtMinor(row.amount_minor)} ${row.currency}` },
    { key: "error_code", title: t("wallet.errorCode"), render: (row) => row.error_code ?? "-" },
    { key: "created_at", title: t("common.time"), render: (row) => fmtTime(row.created_at) },
  ];

  const opColumns: ColumnDef<OpRow>[] = [
    { key: "id", title: "Op", render: (row) => <span className="ab-mono">{row.id.slice(0, 10)}…</span> },
    { key: "intent_id", title: "Intent", render: (row) => <span className="ab-mono">{row.intent_id.slice(0, 10)}…</span> },
    { key: "direction", title: t("wallet.direction"), render: (row) => <Badge tone={row.direction === "DEBIT" ? "amber" : "green"}>{row.direction}</Badge> },
    { key: "status", title: t("common.status"), render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    { key: "amount_minor", title: t("common.amount"), render: (row) => `${fmtMinor(row.amount_minor)} ${row.currency}` },
    { key: "created_at", title: t("common.time"), render: (row) => fmtTime(row.created_at) },
  ];

  const integrityColumns: ColumnDef<IntegrityItem>[] = [
    { key: "severity", title: tt("wallet.severity"), render: (row) => <Badge tone={statusTone(row.severity)}>{row.severity}</Badge> },
    { key: "code", title: tt("wallet.exceptionCode"), render: (row) => <Badge tone="purple">{row.code}</Badge> },
    { key: "subjectType", title: tt("wallet.subjectType") },
    { key: "subjectId", title: "ID", render: (row) => <span className="ab-mono">{row.subjectId.slice(0, 14)}…</span> },
    { key: "playerId", title: tt("wallet.playerId"), render: (row) => row.playerId ? <span className="ab-mono">{row.playerId.slice(0, 10)}…</span> : "-" },
    { key: "message", title: tt("wallet.exceptionMessage") },
  ];

  return (
    <div>
      <ReadonlyBanner text={t("wallet.readonlyHint")} />
      <div className="ab-money-gate-banner" role="status">
        <div><b>{tt("money.realProvider")}:</b> {tt("money.notConfigured")}</div>
        <div><b>{tt("money.productionMoney")}:</b> {tt("money.gateClosed")}</div>
      </div>
      <div className="ab-toolbar">
        <div className="ab-lang">
          {(["balances", "intents", "ops", "integrity"] as View[]).map((key) => {
            if (key === "integrity" && !can("wallet:integrity:view")) return null;
            return (
              <button
                key={key}
                className={view === key ? "active" : undefined}
                onClick={() => {
                  setView(key);
                  setPage(1);
                  setStatus("");
                }}
              >
                {tt(`wallet.tab.${key}`)}
              </button>
            );
          })}
        </div>
        {view !== "integrity" ? (
          <>
            <input
              className="ab-input"
              placeholder={`${t("common.search")} · Player / ID`}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            {view === "balances" ? (
              <select
                className="ab-select"
                value={currency}
                onChange={(event) => {
                  setCurrency(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t("common.all")} / Currency</option>
                <option value="MMK">MMK</option>
                <option value="USDT">USDT</option>
              </select>
            ) : null}
            <select
              className="ab-select"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("common.all")}</option>
              {(view === "balances"
                ? ["ACTIVE", "LOCKED", "CLOSED"]
                : view === "intents"
                  ? INTENT_STATUSES
                  : OP_STATUSES
              ).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            {view === "intents" ? (
              <select
                className="ab-select"
                value={operation}
                onChange={(event) => {
                  setOperation(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t("common.all")}</option>
                {OPERATIONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            ) : null}
          </>
        ) : null}
        <button className="ab-btn" onClick={() => void load()}>⟳ {t("common.refresh")}</button>
      </div>

      {error ? <ErrorBox message={error} /> : null}
      {!data ? (
        <Loading text={t("common.loading")} />
      ) : view === "balances" ? (
        <>
          <div className="ab-chip" style={{ marginBottom: 8 }}>{tt("wallet.balanceSourceHint")}</div>
          <DataTable
            columns={balanceColumns}
            rows={data.items as BalanceRow[]}
            empty={t("common.empty")}
            onRowClick={(row) => void openWallet(row.playerId)}
          />
          <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      ) : view === "integrity" ? (
        <>
          <div className="ab-chip" style={{ marginBottom: 8 }}>
            {tt("wallet.integrityReadonly")}
            {integrity?.scannedAt ? ` · ${fmtTime(integrity.scannedAt)}` : ""}
          </div>
          <DataTable columns={integrityColumns} rows={(data.items as IntegrityItem[])} empty={tt("wallet.integrityEmpty")} />
        </>
      ) : (
        <>
          {view === "intents" ? (
            <DataTable
              columns={intentColumns}
              rows={data.items as IntentRow[]}
              empty={t("common.empty")}
              onRowClick={(row) => void openIntent(row.id)}
            />
          ) : (
            <DataTable columns={opColumns} rows={data.items as OpRow[]} empty={t("common.empty")} />
          )}
          <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}

      {walletDetail ? (
        <div className="ab-modal-mask" onClick={() => setWalletDetail(null)}>
          <div className="ab-modal wide" onClick={(event) => event.stopPropagation()}>
            <div className="ab-modal-title">
              {tt("wallet.walletDetail")} <span className="ab-mono">{walletDetail.playerId}</span>
            </div>
            <div className="ab-stat-grid" style={{ marginTop: 12 }}>
              <StatCard label={tt("wallet.totalBalance")} value={`${fmtMinor(walletDetail.totalMinor)} ${walletDetail.currency}`} />
              <StatCard label={tt("wallet.availableBalance")} value={`${fmtMinor(walletDetail.availableMinor)} ${walletDetail.currency}`} tone="ok" />
              <StatCard label={tt("wallet.frozenBalance")} value={`${fmtMinor(walletDetail.frozenMinor)} ${walletDetail.currency}`} tone={walletDetail.frozenMinor > 0 ? "warn" : "ok"} />
              <StatCard label={t("common.status")} value={walletDetail.status} />
            </div>
            <div className="ab-kv" style={{ marginTop: 12 }}>
              <div className="ab-kv-item"><span className="k">{tt("wallet.walletId")}</span><span className="v ab-mono">{walletDetail.walletId ?? "-"}</span></div>
              <div className="ab-kv-item"><span className="k">Adapter</span><span className="v ab-mono">{walletDetail.walletAdapterRef}</span></div>
              <div className="ab-kv-item"><span className="k">{t("common.createdAt")}</span><span className="v">{fmtTime(walletDetail.createdAt)}</span></div>
              <div className="ab-kv-item"><span className="k">{tt("wallet.lastUpdated")}</span><span className="v">{fmtTime(walletDetail.updatedAt)}</span></div>
              <div className="ab-kv-item"><span className="k">frozenMinor source</span><span className="v" style={{ fontSize: 12 }}>{walletDetail.source.frozen}</span></div>
            </div>
            <div className="ab-panel-title" style={{ marginTop: 16 }}>{tt("wallet.recentLedger")}</div>
            <DataTable
              columns={[
                { key: "id", title: "Ledger", render: (row) => <span className="ab-mono">{String(row.id ?? "").slice(0, 10)}…</span> },
                { key: "kind", title: t("ledger.kind"), render: (row) => String(row.kind ?? "") },
                { key: "direction", title: t("wallet.direction"), render: (row) => String(row.direction ?? "") },
                { key: "amount_minor", title: t("common.amount"), render: (row) => fmtMinor(Number(row.amount_minor ?? 0)) },
                { key: "created_at", title: t("common.time"), render: (row) => fmtTime(String(row.created_at ?? "")) },
              ]}
              rows={walletDetail.recentLedger}
              empty={t("common.empty")}
              onRowClick={(row) => {
                setWalletDetail(null);
                openTab({
                  key: `ledger:${String(row.id)}`,
                  titleKey: "nav.ledger",
                  props: { transactionId: String(row.id), playerId: walletDetail.playerId },
                });
              }}
            />
            <div className="ab-modal-actions">
              <button
                className="ab-btn"
                onClick={() => {
                  setWalletDetail(null);
                  openTab({
                    key: `ledger:p:${walletDetail.playerId}`,
                    titleKey: "nav.ledger",
                    props: { playerId: walletDetail.playerId },
                  });
                }}
              >
                {tt("wallet.openLedger")}
              </button>
              <button
                className="ab-btn"
                onClick={() => {
                  setWalletDetail(null);
                  openTab({
                    key: `players:${walletDetail.playerId}`,
                    titleKey: "nav.players",
                    props: { playerId: walletDetail.playerId },
                  });
                }}
              >
                {tt("wallet.openPlayer")}
              </button>
              <button className="ab-btn primary" onClick={() => setWalletDetail(null)}>{t("common.close")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {intentDetail ? (
        <div className="ab-modal-mask" onClick={() => setIntentDetail(null)}>
          <div className="ab-modal wide" onClick={(event) => event.stopPropagation()}>
            <div className="ab-modal-title">
              {t("wallet.detail")} <span className="ab-mono">{String(intentDetail.intent.id)}</span>
            </div>
            <div className="ab-kv" style={{ marginTop: 12 }}>
              <div className="ab-kv-item"><span className="k">{tt("wallet.playerId")}</span><span className="v ab-mono">{String(intentDetail.intent.player_id)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("wallet.operation")}</span><span className="v">{String(intentDetail.intent.operation)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("common.status")}</span><span className="v"><Badge tone={statusTone(String(intentDetail.intent.status))}>{String(intentDetail.intent.status)}</Badge></span></div>
              <div className="ab-kv-item"><span className="k">{t("common.amount")}</span><span className="v">{fmtMinor(Number(intentDetail.intent.amount_minor))} {String(intentDetail.intent.currency)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("wallet.ledgerTxId")}</span><span className="v ab-mono">{intentDetail.intent.ledger_tx_id ? String(intentDetail.intent.ledger_tx_id) : "-"}</span></div>
            </div>
            <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("wallet.timeline")}</div>
            <div className="ab-timeline">
              {intentDetail.timeline.length === 0 ? (
                <div className="ab-chip">{t("common.empty")}</div>
              ) : (
                intentDetail.timeline.map((item, index) => (
                  <div key={`${item.ref}-${index}`} className="ab-timeline-item">
                    <div className="ab-timeline-dot" />
                    <div>
                      <div><Badge tone={statusTone(item.status)}>{item.stage}</Badge> · {item.status}</div>
                      <div className="ab-mono" style={{ fontSize: 12, opacity: 0.8 }}>{item.ref}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{fmtTime(item.at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="ab-modal-actions">
              <button className="ab-btn" onClick={() => setIntentDetail(null)}>{t("common.close")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

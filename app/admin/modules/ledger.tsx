"use client";

/** R1-M7 — Ledger: accounts / transactions / entries / balances / health (read-only). */

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

export default function LedgerModule() {
  const { t, api } = useAdmin();
  const [view, setView] = useState<View>("health");
  const [page, setPage] = useState(1);
  const [txFilter, setTxFilter] = useState("");
  const [data, setData] = useState<{ total?: number; pageSize?: number; items?: Row[]; ok?: boolean; unbalancedTx?: number; projectionMismatch?: number; checkedTx?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      if (view === "health") {
        setData(await api("ledger/health"));
      } else {
        const params = new URLSearchParams({ page: String(page), pageSize: "20" });
        if (view === "entries" && txFilter) params.set("transactionId", txFilter);
        setData(await api(`ledger/${view}?${params}`));
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, page, txFilter, view]);

  useEffect(() => {
    void load();
  }, [load]);

  const accountColumns: ColumnDef<Row>[] = [
    { key: "id", title: t("ledger.account"), render: (row) => <span className="ab-mono">{String(row.id ?? "").slice(0, 12)}…</span> },
    { key: "kind", title: t("ledger.kind"), render: (row) => <Badge tone="purple">{String(row.kind ?? "")}</Badge> },
    { key: "player_id", title: t("rounds.playerId"), render: (row) => row.player_id ? <span className="ab-mono">{String(row.player_id).slice(0, 10)}…</span> : "-" },
    { key: "currency", title: t("common.currency"), render: (row) => String(row.currency ?? "") },
    { key: "balance_minor", title: t("common.balance"), render: (row) => fmtMinor(Number(row.balance_minor ?? 0)) },
    { key: "version", title: t("ledger.version"), render: (row) => String(row.version ?? "") },
  ];

  const txColumns: ColumnDef<Row>[] = [
    { key: "id", title: "Tx", render: (row) => <span className="ab-mono">{String(row.id ?? "").slice(0, 12)}…</span> },
    { key: "status", title: t("common.status"), render: (row) => <Badge tone={row.status === "POSTED" ? "green" : row.status === "REVERSED" ? "amber" : "gray"}>{String(row.status ?? "")}</Badge> },
    { key: "idempotency_key", title: t("ledger.idempotencyKey"), render: (row) => <span className="ab-mono">{String(row.idempotency_key ?? "").slice(0, 14)}…</span> },
    { key: "posted_at", title: t("ledger.postedAt"), render: (row) => fmtTime(String(row.posted_at ?? row.created_at ?? "")) },
  ];

  const entryColumns: ColumnDef<Row>[] = [
    { key: "id", title: "Entry", render: (row) => <span className="ab-mono">{String(row.id ?? "").slice(0, 10)}…</span> },
    { key: "transaction_id", title: "Tx", render: (row) => <span className="ab-mono">{String(row.transaction_id ?? "").slice(0, 10)}…</span> },
    { key: "account_id", title: t("ledger.account"), render: (row) => <span className="ab-mono">{String(row.account_id ?? "").slice(0, 10)}…</span> },
    { key: "direction", title: t("ledger.kind"), render: (row) => <Badge tone={row.direction === "DEBIT" ? "amber" : "green"}>{String(row.direction ?? "")}</Badge> },
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
        <div className="ab-stat-grid">
          <StatCard label={t("ledger.health")} value={data.ok ? t("ledger.healthOk") : t("ledger.healthIssues")} tone={data.ok ? "ok" : "bad"} />
          <StatCard label={t("ledger.unbalancedTx")} value={String(data.unbalancedTx ?? 0)} tone={(data.unbalancedTx ?? 0) > 0 ? "bad" : "ok"} />
          <StatCard label={t("ledger.projectionMismatch")} value={String(data.projectionMismatch ?? 0)} tone={(data.projectionMismatch ?? 0) > 0 ? "bad" : "ok"} />
          <StatCard label={t("ledger.checkedTx")} value={String(data.checkedTx ?? 0)} />
        </div>
      ) : (
        <>
          {view === "entries" ? (
            <div className="ab-toolbar">
              <input
                className="ab-input"
                placeholder="transactionId"
                value={txFilter}
                onChange={(e) => { setTxFilter(e.target.value); setPage(1); }}
              />
            </div>
          ) : null}
          <DataTable
            columns={
              view === "accounts" ? accountColumns
                : view === "transactions" ? txColumns
                  : view === "entries" ? entryColumns
                    : balColumns
            }
            rows={(data.items ?? []) as Row[]}
            empty={t("common.empty")}
          />
          {typeof data.total === "number" && typeof data.pageSize === "number" ? (
            <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          ) : null}
        </>
      )}
    </div>
  );
}

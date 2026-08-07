"use client";

/** R1-M7 — Wallet: intents + provider ops, strictly read-only. */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DataTable,
  ErrorBox,
  Loading,
  Pagination,
  ReadonlyBanner,
  fmtMinor,
  fmtTime,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

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

const INTENT_STATUSES = ["NEW", "LOCKED", "PROCESSING", "SUCCESS", "FAILED", "UNKNOWN", "RECOVERED"];
const OP_STATUSES = ["NEW", "PROCESSING", "SUCCESS", "SETTLED", "FAILED", "UNKNOWN", "RECOVER"];
const OPERATIONS = ["DEBIT", "CREDIT", "SETTLE", "ROLLBACK"];

function statusTone(status: string): "green" | "red" | "amber" | "blue" | "gray" {
  if (status === "SUCCESS" || status === "SETTLED" || status === "RECOVERED") return "green";
  if (status === "FAILED" || status === "UNKNOWN") return "red";
  if (status === "PROCESSING" || status === "LOCKED" || status === "RECOVER") return "amber";
  return "blue";
}

export default function WalletModule() {
  const { t, api } = useAdmin();
  const [view, setView] = useState<"intents" | "ops">("intents");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [operation, setOperation] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; pageSize: number; items: (IntentRow | OpRow)[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (operation && view === "intents") params.set("operation", operation);
      setData(await api(`wallet/${view === "intents" ? "intents" : "provider-ops"}?${params}`));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, page, search, status, operation, view]);

  useEffect(() => {
    void load();
  }, [load]);

  const intentColumns: ColumnDef<IntentRow>[] = [
    { key: "id", title: "Intent", render: (row) => <span className="ab-mono">{row.id.slice(0, 10)}…</span> },
    { key: "player_id", title: t("rounds.playerId"), render: (row) => <span className="ab-mono">{row.player_id.slice(0, 10)}…</span> },
    { key: "operation", title: t("wallet.operation"), render: (row) => <Badge tone="purple">{row.operation}</Badge> },
    { key: "status", title: t("common.status"), render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    { key: "amount_minor", title: t("common.amount"), render: (row) => `${fmtMinor(row.amount_minor)} ${row.currency}` },
    { key: "error_code", title: t("wallet.errorCode"), render: (row) => row.error_code ?? "-" },
    { key: "idempotency_key", title: t("rounds.idempotencyKey"), render: (row) => <span className="ab-mono">{row.idempotency_key.slice(0, 14)}…</span> },
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

  return (
    <div>
      <ReadonlyBanner text={t("wallet.readonlyHint")} />
      <div className="ab-toolbar">
        <div className="ab-lang">
          <button className={view === "intents" ? "active" : undefined} onClick={() => { setView("intents"); setPage(1); setStatus(""); }}>
            {t("wallet.intents")}
          </button>
          <button className={view === "ops" ? "active" : undefined} onClick={() => { setView("ops"); setPage(1); setStatus(""); }}>
            {t("wallet.providerOps")}
          </button>
        </div>
        <input
          className="ab-input"
          placeholder={`${t("common.search")} · ID / ${t("rounds.idempotencyKey")}`}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          className="ab-select"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("common.all")}</option>
          {(view === "intents" ? INTENT_STATUSES : OP_STATUSES).map((item) => (
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
        <button className="ab-btn" onClick={() => void load()}>⟳ {t("common.refresh")}</button>
      </div>

      {error ? <ErrorBox message={error} /> : null}
      {!data ? (
        <Loading text={t("common.loading")} />
      ) : (
        <>
          {view === "intents" ? (
            <DataTable columns={intentColumns} rows={data.items as IntentRow[]} empty={t("common.empty")} />
          ) : (
            <DataTable columns={opColumns} rows={data.items as OpRow[]} empty={t("common.empty")} />
          )}
          <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

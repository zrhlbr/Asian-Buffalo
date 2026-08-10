"use client";

/** ADMIN-1D — Withdrawal orders (view/search first; pay gated). */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DataTable,
  ErrorBox,
  Loading,
  Pagination,
  fmtMinor,
  fmtTime,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type WithdrawalRow = {
  id: string;
  playerId: string;
  currency: string;
  channelCode: string;
  accountMasked: string;
  amountMinor: number;
  feeMinor: number;
  expectedMinor: number;
  status: string;
  riskFlag: string | null;
  createdAt: string;
  updatedAt?: string;
};

type MoneyGate = {
  testHarnessEnabled: boolean;
  gate: string;
};

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export default function WithdrawalsModule() {
  const { t, api, toast } = useAdmin();
  const tt = t as (k: string) => string;
  const [items, setItems] = useState<WithdrawalRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [status, setStatus] = useState("");
  const [gate, setGate] = useState<MoneyGate | null>(null);
  const debouncedPlayer = useDebounced(playerId, 350);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (debouncedPlayer) params.set("playerId", debouncedPlayer);
      if (status) params.set("status", status);
      const [result, gateResult] = await Promise.all([
        api<{ items: WithdrawalRow[]; total?: number }>(`withdrawals?${params}`),
        api<MoneyGate>("money/gate").catch(() => null),
      ]);
      setItems(result.items);
      setTotal(result.total ?? result.items.length);
      if (gateResult) setGate(gateResult);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, page, debouncedPlayer, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: "approve" | "reject" | "pay") => {
    if (action === "pay" && !gate?.testHarnessEnabled) {
      toast(tt("money.providerNotConfigured"), true);
      return;
    }
    if (reason.trim().length < 2) {
      toast(t("deposits.reason"), true);
      return;
    }
    setBusyId(id);
    try {
      await api(`withdrawals/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
        body: { reason: reason.trim() },
      });
      toast(t("common.success"));
      await load();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    } finally {
      setBusyId(null);
    }
  };

  const columns: ColumnDef<WithdrawalRow>[] = [
    { key: "id", title: tt("withdrawals.orderId"), render: (r) => <span className="ab-mono">{r.id.slice(0, 10)}…</span> },
    { key: "playerId", title: tt("wallet.playerId"), render: (r) => <span className="ab-mono">{r.playerId.slice(0, 10)}…</span> },
    { key: "currency", title: t("common.currency") },
    {
      key: "amountMinor",
      title: t("common.amount"),
      render: (r) => <span className="ab-money">{fmtMinor(r.amountMinor)} {r.currency}</span>,
    },
    {
      key: "feeMinor",
      title: tt("withdrawals.fee"),
      render: (r) => <span className="ab-money">{fmtMinor(r.feeMinor)} {r.currency}</span>,
    },
    {
      key: "expectedMinor",
      title: tt("withdrawals.netAmount"),
      render: (r) => <span className="ab-money">{fmtMinor(r.expectedMinor)} {r.currency}</span>,
    },
    {
      key: "accountMasked",
      title: tt("withdrawals.destination"),
      render: (r) => <span className="ab-mono">{r.accountMasked || "****"}</span>,
    },
    {
      key: "status",
      title: t("common.status"),
      render: (r) => <Badge tone="gray">{r.status}</Badge>,
    },
    { key: "createdAt", title: t("common.createdAt"), render: (r) => fmtTime(r.createdAt) },
    { key: "updatedAt", title: t("common.updatedAt"), render: (r) => fmtTime(r.updatedAt) },
    {
      key: "actions",
      title: t("common.actions"),
      render: (r) => (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {gate?.testHarnessEnabled && ["PENDING", "UNDER_REVIEW"].includes(r.status) ? (
            <>
              <button className="ab-btn primary" disabled={busyId === r.id} onClick={() => void act(r.id, "approve")}>
                {t("withdrawals.approve")}
              </button>
              <button className="ab-btn" disabled={busyId === r.id} onClick={() => void act(r.id, "reject")}>
                {t("withdrawals.reject")}
              </button>
            </>
          ) : null}
          {gate?.testHarnessEnabled && ["APPROVED", "PAYING"].includes(r.status) ? (
            <button className="ab-btn primary" disabled={busyId === r.id} onClick={() => void act(r.id, "pay")}>
              {t("withdrawals.pay")}
            </button>
          ) : (
            <span className="ab-chip">{tt("money.gateClosed")}</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="ab-money-gate-banner" role="status">
        <div><b>{tt("money.realProvider")}:</b> {tt("money.notConfigured")}</div>
        <div><b>{tt("money.productionMoney")}:</b> {tt("money.gateClosed")}</div>
        <div>{tt("withdrawals.gateHint")}</div>
      </div>
      <div className="ab-readonly-banner">⚠ {t("withdrawals.pendingRules")}</div>
      <div className="ab-toolbar">
        <input
          className="ab-input"
          placeholder={tt("wallet.playerId")}
          value={playerId}
          onChange={(e) => { setPlayerId(e.target.value); setPage(1); }}
        />
        <select className="ab-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">{t("common.all")}</option>
          {["PENDING", "UNDER_REVIEW", "APPROVED", "PAYING", "PAID", "REJECTED", "CANCELLED", "FAILED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button className="ab-btn" onClick={() => void load()}>
          ⟳ {t("common.refresh")}
        </button>
      </div>
      {error ? <ErrorBox message={error} /> : null}
      {gate?.testHarnessEnabled ? (
        <div className="ab-field" style={{ maxWidth: 420, marginBottom: 12 }}>
          <label>{t("deposits.reason")} ({tt("deposits.harnessOnly")})</label>
          <input className="ab-input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      ) : null}
      {!items ? (
        <Loading text={t("common.loading")} />
      ) : (
        <>
          <div className="ab-table-scroll">
            <DataTable columns={columns} rows={items} empty={t("common.empty")} />
          </div>
          <Pagination page={page} pageSize={20} total={total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

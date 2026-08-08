"use client";

/** Step 4 — Deposit orders admin (query + test confirm harness). */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DataTable,
  ErrorBox,
  Loading,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type DepositRow = {
  id: string;
  playerId: string;
  currency: string;
  channelCode: string;
  amountMinor: number;
  status: string;
  providerRef: string | null;
  createdAt: string;
};

export default function DepositsModule() {
  const { t, api, toast } = useAdmin();
  const [items, setItems] = useState<DepositRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api<{ items: DepositRow[] }>("deposits");
      setItems(result.items);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api]);

  useEffect(() => {
    // Initial fetch — same pattern as vip/wallet admin modules.
    void load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load()
  }, [load]);

  const confirm = async (id: string) => {
    if (reason.trim().length < 2) {
      toast(t("deposits.reason"), true);
      return;
    }
    setBusyId(id);
    try {
      await api(`deposits/${encodeURIComponent(id)}/confirm`, {
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

  const columns: ColumnDef<DepositRow>[] = [
    { key: "id", title: "ID", render: (r) => <span className="ab-mono">{r.id.slice(0, 8)}</span> },
    { key: "playerId", title: t("players.uid") },
    { key: "channelCode", title: "Channel" },
    { key: "amountMinor", title: t("common.balance") },
    {
      key: "status",
      title: t("common.status"),
      render: (r) => (
        <Badge tone={r.status === "SUCCESS" ? "green" : r.status === "FAILED" ? "red" : "gray"}>
          {r.status}
        </Badge>
      ),
    },
    { key: "createdAt", title: t("common.createdAt") },
    {
      key: "actions",
      title: t("common.actions"),
      render: (r) =>
        ["CREATED", "PENDING", "PROCESSING"].includes(r.status) ? (
          <button
            className="ab-btn"
            disabled={busyId === r.id}
            onClick={() => void confirm(r.id)}
          >
            {t("deposits.confirm")}
          </button>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div>
      <div className="ab-readonly-banner">⚠ {t("deposits.pendingRules")}</div>
      <div className="ab-toolbar">
        <button className="ab-btn" onClick={() => void load()}>
          ⟳ {t("common.refresh")}
        </button>
      </div>
      {error ? <ErrorBox message={error} /> : null}
      <div className="ab-field" style={{ maxWidth: 420, marginBottom: 12 }}>
        <label>{t("deposits.reason")}</label>
        <input className="ab-input" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {!items ? (
        <Loading text={t("common.loading")} />
      ) : (
        <DataTable columns={columns} rows={items} empty={t("common.empty")} />
      )}
    </div>
  );
}

"use client";

/** Step 4 — Withdrawal review / pay (RBAC + audit reason). */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DataTable,
  ErrorBox,
  Loading,
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
};

export default function WithdrawalsModule() {
  const { t, api, toast } = useAdmin();
  const [items, setItems] = useState<WithdrawalRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api<{ items: WithdrawalRow[] }>("withdrawals");
      setItems(result.items);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load()
  }, [load]);

  const act = async (id: string, action: "approve" | "reject" | "pay") => {
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
    { key: "id", title: "ID", render: (r) => <span className="ab-mono">{r.id.slice(0, 8)}</span> },
    { key: "playerId", title: t("players.uid") },
    { key: "channelCode", title: "Channel" },
    { key: "accountMasked", title: "Account" },
    { key: "amountMinor", title: t("common.balance") },
    { key: "expectedMinor", title: "Expected" },
    {
      key: "status",
      title: t("common.status"),
      render: (r) => <Badge tone="gray">{r.status}</Badge>,
    },
    {
      key: "actions",
      title: t("common.actions"),
      render: (r) => (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["PENDING", "UNDER_REVIEW"].includes(r.status) ? (
            <>
              <button className="ab-btn primary" disabled={busyId === r.id} onClick={() => void act(r.id, "approve")}>
                {t("withdrawals.approve")}
              </button>
              <button className="ab-btn" disabled={busyId === r.id} onClick={() => void act(r.id, "reject")}>
                {t("withdrawals.reject")}
              </button>
            </>
          ) : null}
          {["APPROVED", "PAYING"].includes(r.status) ? (
            <button className="ab-btn primary" disabled={busyId === r.id} onClick={() => void act(r.id, "pay")}>
              {t("withdrawals.pay")}
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="ab-readonly-banner">⚠ {t("withdrawals.pendingRules")}</div>
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

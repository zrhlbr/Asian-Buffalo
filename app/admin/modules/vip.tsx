"use client";

/** R1 screenshot-features — VIP level config + player VIP assign (additive). */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DataTable,
  ErrorBox,
  Loading,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type VipLevelRow = {
  level: number;
  code: string;
  title: Record<string, string>;
  conditions: Record<string, unknown>;
  enabled: boolean;
  updatedAt: string;
};

export default function VipModule() {
  const { t, api, toast } = useAdmin();
  const [items, setItems] = useState<VipLevelRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [level, setLevel] = useState(1);
  const [status, setStatus] = useState("ACTIVE");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api<{ items: VipLevelRow[] }>("vip/levels");
      setItems(result.items);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const assign = async () => {
    if (!playerId.trim() || reason.trim().length < 2) {
      toast(t("vip.reasonRequired"), true);
      return;
    }
    setBusy(true);
    try {
      await api(`vip/players/${encodeURIComponent(playerId.trim())}`, {
        method: "POST",
        body: {
          reason: reason.trim(),
          level,
          status,
          vipExpiresAt: expiresAt.trim() || null,
        },
      });
      toast(t("common.success"));
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<VipLevelRow>[] = [
    { key: "level", title: t("vip.level") },
    { key: "code", title: t("vip.code") },
    {
      key: "title",
      title: t("vip.title"),
      render: (row) => row.title?.["zh-CN"] ?? row.title?.en ?? "—",
    },
    {
      key: "conditions",
      title: t("vip.conditions"),
      render: (row) => (
        <span className="ab-mono" style={{ fontSize: 11 }}>
          {JSON.stringify(row.conditions)}
        </span>
      ),
    },
    {
      key: "enabled",
      title: t("common.status"),
      render: (row) =>
        row.enabled ? <Badge tone="green">ON</Badge> : <Badge tone="gray">OFF</Badge>,
    },
  ];

  return (
    <div>
      <div className="ab-readonly-banner">⚠ {t("vip.pendingRules")}</div>
      <div className="ab-chip-row" style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <span className="ab-chip">RTP Bonus = BLOCKED</span>
        <span className="ab-chip">Money Multiplier = BLOCKED</span>
        <span className="ab-chip">Wallet Credit = BLOCKED</span>
      </div>
      <div className="ab-toolbar">
        <button className="ab-btn" onClick={() => void load()}>
          ⟳ {t("common.refresh")}
        </button>
      </div>
      {error ? <ErrorBox message={error} /> : null}
      {!items ? (
        <Loading text={t("common.loading")} />
      ) : (
        <DataTable columns={columns} rows={items} empty={t("common.empty")} />
      )}

      <div className="ab-panel-title" style={{ marginTop: 20 }}>
        {t("vip.assignPlayer")}
      </div>
      <div className="ab-toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
        <input
          className="ab-input"
          placeholder="playerId"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
        />
        <select className="ab-select" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
          {[0, 1, 2, 3, 4, 5, 6].map((lv) => (
            <option key={lv} value={lv}>
              L{lv}
            </option>
          ))}
        </select>
        <select className="ab-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["ACTIVE", "EXPIRED", "PENDING", "SUSPENDED"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          className="ab-input"
          placeholder="vipExpiresAt (optional)"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
        <input
          className="ab-input"
          placeholder={t("common.reason")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button className="ab-btn primary" disabled={busy} onClick={() => void assign()}>
          {t("vip.assign")}
        </button>
      </div>
    </div>
  );
}

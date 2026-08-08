"use client";

/** Step 4 — Activities admin (upsert + list). Check-in config via BUSINESS_RULES_PENDING. */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DataTable,
  ErrorBox,
  Loading,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type ActivityRow = {
  id: string;
  code: string;
  kind: string;
  title: Record<string, string>;
  rewardMinor: number;
  currency: string;
  enabled: boolean;
  joinable: boolean;
  lockedReason: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

export default function ActivitiesModule() {
  const { t, api, toast } = useAdmin();
  const [items, setItems] = useState<ActivityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("EVENT_NEW");
  const [rewardMinor, setRewardMinor] = useState(100);
  const [titleZh, setTitleZh] = useState("新活动");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api<{ items: ActivityRow[] }>("activities");
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

  const save = async () => {
    if (reason.trim().length < 2) {
      toast(t("deposits.reason"), true);
      return;
    }
    setBusy(true);
    try {
      await api("activities", {
        method: "POST",
        body: {
          reason: reason.trim(),
          code: code.trim(),
          kind: "EVENT",
          rewardMinor,
          title: { "zh-CN": titleZh, en: titleZh, "my-MM": titleZh },
          startsAt: "2020-01-01 00:00:00",
          endsAt: "2099-01-01 00:00:00",
          enabled: true,
        },
      });
      toast(t("common.success"));
      await load();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<ActivityRow>[] = [
    { key: "code", title: "Code" },
    {
      key: "title",
      title: t("vip.title"),
      render: (r) => r.title?.["zh-CN"] ?? r.title?.en ?? "—",
    },
    { key: "rewardMinor", title: t("common.balance") },
    {
      key: "enabled",
      title: t("common.status"),
      render: (r) =>
        r.enabled ? <Badge tone="green">ON</Badge> : <Badge tone="gray">OFF</Badge>,
    },
    {
      key: "joinable",
      title: "Joinable",
      render: (r) => (r.joinable ? "YES" : r.lockedReason ?? "NO"),
    },
    { key: "endsAt", title: "Ends" },
  ];

  return (
    <div>
      <div className="ab-readonly-banner">⚠ {t("activities.pendingRules")}</div>
      {error ? <ErrorBox message={error} /> : null}
      <div style={{ display: "grid", gap: 8, maxWidth: 480, marginBottom: 16 }}>
        <div className="ab-field">
          <label>Code</label>
          <input className="ab-input" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="ab-field">
          <label>Title (zh)</label>
          <input className="ab-input" value={titleZh} onChange={(e) => setTitleZh(e.target.value)} />
        </div>
        <div className="ab-field">
          <label>Reward minor</label>
          <input
            className="ab-input"
            type="number"
            value={rewardMinor}
            onChange={(e) => setRewardMinor(Number(e.target.value))}
          />
        </div>
        <div className="ab-field">
          <label>{t("deposits.reason")}</label>
          <input className="ab-input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <button className="ab-btn primary" disabled={busy} onClick={() => void save()}>
          {t("activities.save")}
        </button>
      </div>
      {!items ? (
        <Loading text={t("common.loading")} />
      ) : (
        <DataTable columns={columns} rows={items} empty={t("common.empty")} />
      )}
    </div>
  );
}

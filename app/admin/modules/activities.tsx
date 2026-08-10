"use client";

/** ADMIN-1F Activities — trilingual upsert; admin payout BLOCKED. */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DangerConfirm,
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

function titleOf(row: ActivityRow): string {
  return row.title?.zh || row.title?.["zh-CN"] || row.title?.en || "—";
}

export default function ActivitiesModule() {
  const { t, api, toast, can } = useAdmin();
  const [items, setItems] = useState<ActivityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("EVENT_NEW");
  const [kind, setKind] = useState("EVENT");
  const [rewardMinor, setRewardMinor] = useState(100);
  const [zh, setZh] = useState("");
  const [en, setEn] = useState("");
  const [my, setMy] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const canManage = can("activity:manage");

  const load = useCallback(async () => {
    try {
      const result = await api<{ items: ActivityRow[]; rewardPayout?: string }>("activities");
      setItems(result.items);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const runSave = async (reason: string) => {
    if (enabled && !(zh.trim() && en.trim() && my.trim())) {
      toast(t("announcements.publishNeedLocales"), true);
      return;
    }
    setBusy(true);
    try {
      await api("activities", {
        method: "POST",
        body: {
          reason,
          code: code.trim(),
          kind,
          rewardMinor,
          title: { zh, en, my },
          body: { zh, en, my },
          startsAt: "2020-01-01 00:00:00",
          endsAt: "2099-01-01 00:00:00",
          enabled,
        },
      });
      toast(t("common.success"));
      setConfirm(false);
      await load();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<ActivityRow>[] = [
    { key: "code", title: "Code", render: (r) => r.code },
    { key: "kind", title: t("content.type"), render: (r) => r.kind },
    { key: "title", title: t("vip.title"), render: (r) => titleOf(r) },
    {
      key: "rewardMinor",
      title: t("activities.rewardSummary"),
      render: (r) => `${(r.rewardMinor / 100).toFixed(2)} ${r.currency} (display)`,
    },
    {
      key: "enabled",
      title: t("common.status"),
      render: (r) =>
        r.enabled ? <Badge tone="green">ACTIVE</Badge> : <Badge tone="gray">PAUSED</Badge>,
    },
    {
      key: "joinable",
      title: t("activities.joinable"),
      render: (r) => (r.joinable ? "YES" : r.lockedReason ?? "NO"),
    },
  ];

  return (
    <div>
      <div className="ab-readonly-banner">⚠ {t("activities.pendingRules")}</div>
      <div className="ab-chip-row" style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <span className="ab-chip">REWARD_PAYOUT=BLOCKED</span>
        <span className="ab-chip">{t("activities.noAdminCredit")}</span>
      </div>
      {error ? <ErrorBox message={error} /> : null}

      {canManage ? (
        <div className="ab-card" style={{ marginBottom: 12, display: "grid", gap: 8, maxWidth: 560 }}>
          <b>{t("activities.save")}</b>
          <input className="ab-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code" />
          <select className="ab-input" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="CHECKIN">Daily Check-in</option>
            <option value="NEW_PLAYER">New Player</option>
            <option value="VIP">VIP Activity</option>
            <option value="EVENT">Limited Event</option>
            <option value="FESTIVAL">Festival</option>
            <option value="TASK">Task</option>
            <option value="INVITE">Invite</option>
            <option value="JACKPOT">Jackpot Event</option>
          </select>
          <input
            className="ab-input"
            type="number"
            value={rewardMinor}
            onChange={(e) => setRewardMinor(Number(e.target.value))}
            placeholder="rewardMinor"
          />
          <textarea className="ab-input" rows={2} placeholder="ZH" value={zh} onChange={(e) => setZh(e.target.value)} />
          <textarea className="ab-input" rows={2} placeholder="EN" value={en} onChange={(e) => setEn(e.target.value)} />
          <textarea className="ab-input" rows={2} placeholder="MY" value={my} onChange={(e) => setMy(e.target.value)} />
          <label className="ab-chip" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />{" "}
            {enabled ? "ACTIVE" : "PAUSED"}
          </label>
          <button className="ab-btn primary" onClick={() => setConfirm(true)}>
            {t("common.save")}
          </button>
        </div>
      ) : null}

      {!items ? (
        <Loading text={t("common.loading")} />
      ) : (
        <DataTable columns={columns} rows={items} empty={t("common.empty")} />
      )}

      {confirm ? (
        <DangerConfirm
          title={t("activities.save")}
          description={t("common.dangerConfirm")}
          reasonLabel={t("common.reason")}
          reasonRequired={t("common.reasonRequired")}
          hint={t("common.dangerConfirmHint")}
          confirmLabel={t("common.confirm")}
          cancelLabel={t("common.cancel")}
          busy={busy}
          onConfirm={(reason) => void runSave(reason)}
          onCancel={() => setConfirm(false)}
        />
      ) : null}
    </div>
  );
}

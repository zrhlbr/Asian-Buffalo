"use client";

/** R1-M9 — System: status probes, config, draft/schedule/trilingual announcements, logs. */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DangerConfirm,
  DataTable,
  ErrorBox,
  Loading,
  Pagination,
  StatCard,
  fmtTime,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type ConfigItem = {
  key: string;
  value?: unknown;
  value_json?: string;
  updatedBy?: string | null;
  updated_by?: string | null;
  updatedAt?: string;
  updated_at?: string;
  [key: string]: unknown;
};
type Announcement = {
  id: string;
  title: string;
  content: string;
  level: string;
  status: string;
  created_by: string;
  created_at: string;
  [key: string]: unknown;
};
type AuditRow = {
  id: string;
  admin_username: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  reason: string | null;
  ip: string | null;
  created_at: string;
  [key: string]: unknown;
};

function parseAnnouncementContent(content: string): {
  zh: string;
  en: string;
  my: string;
  publishAt: string | null;
  raw: string;
} {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && ("zh" in parsed || "en" in parsed || "my" in parsed)) {
      return {
        zh: typeof parsed.zh === "string" ? parsed.zh : "",
        en: typeof parsed.en === "string" ? parsed.en : "",
        my: typeof parsed.my === "string" ? parsed.my : "",
        publishAt: typeof parsed.publishAt === "string" ? parsed.publishAt : null,
        raw: content,
      };
    }
  } catch {
    // plain text legacy
  }
  return { zh: content, en: content, my: content, publishAt: null, raw: content };
}

function configValueText(row: ConfigItem): string {
  if (row.value !== undefined) return JSON.stringify(row.value);
  if (typeof row.value_json === "string") return row.value_json;
  return "-";
}

export default function SystemModule() {
  const { t, api, toast, locale } = useAdmin();
  const [tab, setTab] = useState<"status" | "config" | "announcements" | "logs">("status");
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [config, setConfig] = useState<ConfigItem[] | null>(null);
  const [anns, setAnns] = useState<Announcement[] | null>(null);
  const [logs, setLogs] = useState<{ total: number; pageSize: number; items: AuditRow[] } | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<
    | { kind: "maint"; enabled: boolean }
    | { kind: "create-ann" }
    | { kind: "ann"; id: string; publish: boolean }
    | null
  >(null);
  const [newTitle, setNewTitle] = useState("");
  const [newZh, setNewZh] = useState("");
  const [newEn, setNewEn] = useState("");
  const [newMy, setNewMy] = useState("");
  const [newPublishAt, setNewPublishAt] = useState("");
  const [asDraft, setAsDraft] = useState(true);

  const load = useCallback(async () => {
    try {
      if (tab === "status") setStatus(await api("system/status"));
      if (tab === "config") {
        const result = await api<{ items: ConfigItem[] }>("system/config");
        setConfig(result.items);
      }
      if (tab === "announcements") {
        const result = await api<{ items: Announcement[] }>("system/announcements");
        setAnns(result.items);
      }
      if (tab === "logs") {
        setLogs(await api(`logs/admin?page=${page}&pageSize=20`));
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, page, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const runConfirm = async (reason: string) => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "maint") {
        await api("system/config", {
          method: "POST",
          body: { key: "maintenance_mode", value: { enabled: confirm.enabled }, reason },
        });
      } else if (confirm.kind === "create-ann") {
        const publishNow = !asDraft;
        if (publishNow && !(newZh.trim() && newEn.trim() && newMy.trim())) {
          toast(t("announcements.publishNeedLocales"), true);
          setBusy(false);
          return;
        }
        await api("system/announcements", {
          method: "POST",
          body: {
            title: newTitle,
            locales: { zh: newZh, en: newEn, my: newMy },
            content: newZh || newEn || newMy,
            publishAt: newPublishAt || undefined,
            status: publishNow ? "PUBLISHED" : "UNPUBLISHED",
            level: "INFO",
            reason,
          },
        });
        setNewTitle("");
        setNewZh("");
        setNewEn("");
        setNewMy("");
        setNewPublishAt("");
        setAsDraft(true);
      } else {
        if (confirm.publish) {
          const row = anns?.find((item) => item.id === confirm.id);
          const content = String(row?.content ?? "");
          let ok = false;
          try {
            const parsed = JSON.parse(content) as Record<string, unknown>;
            ok = Boolean(
              String(parsed.zh ?? "").trim() &&
                String(parsed.en ?? "").trim() &&
                String(parsed.my ?? "").trim(),
            );
          } catch {
            ok = false;
          }
          if (!ok) {
            toast(t("announcements.publishNeedLocales"), true);
            setBusy(false);
            return;
          }
        }
        await api(
          `system/announcements/${encodeURIComponent(confirm.id)}/${confirm.publish ? "publish" : "unpublish"}`,
          { method: "POST", body: { reason } },
        );
      }
      toast(t("common.success"));
      setConfirm(null);
      await load();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    } finally {
      setBusy(false);
    }
  };

  const logColumns: ColumnDef<AuditRow>[] = [
    { key: "created_at", title: t("common.time"), render: (row) => fmtTime(row.created_at) },
    { key: "admin_username", title: t("system.admin"), render: (row) => row.admin_username },
    { key: "action", title: t("system.action"), render: (row) => <span className="ab-mono">{row.action}</span> },
    {
      key: "target_type",
      title: t("system.target"),
      render: (row) => `${row.target_type ?? "-"}:${String(row.target_id ?? "").slice(0, 10)}`,
    },
    { key: "reason", title: t("common.reason"), render: (row) => row.reason ?? "-" },
    { key: "ip", title: t("common.ip"), render: (row) => row.ip ?? "-" },
  ];

  const maint = (() => {
    const row = config?.find((c) => c.key === "maintenance_mode");
    if (!row) return false;
    if (row.value && typeof row.value === "object") {
      return Boolean((row.value as { enabled?: boolean }).enabled);
    }
    try {
      return Boolean((JSON.parse(String(row.value_json ?? "{}")) as { enabled?: boolean }).enabled);
    } catch {
      return false;
    }
  })();

  if (error && tab === "status" && !status) return <ErrorBox message={error} />;

  const dbOk = (status?.database as { ok?: boolean } | undefined)?.ok;
  const dbLatency = (status?.database as { latencyMs?: number } | undefined)?.latencyMs;
  const probes = status?.probes as { dbLatencyMs?: number; ledgerQueryable?: boolean; selectOne?: boolean } | undefined;

  return (
    <div>
      <div className="ab-toolbar">
        {(["status", "config", "announcements", "logs"] as const).map((key) => (
          <button key={key} className={`ab-btn${tab === key ? " primary" : ""}`} onClick={() => setTab(key)}>
            {key === "status"
              ? t("system.apiStatus")
              : key === "config"
                ? t("system.config")
                : key === "announcements"
                  ? t("system.announcements")
                  : t("system.logs")}
          </button>
        ))}
        <button className="ab-btn" onClick={() => void load()}>
          ⟳ {t("common.refresh")}
        </button>
      </div>

      {tab === "status" ? (
        !status ? (
          <Loading text={t("common.loading")} />
        ) : (
          <>
            <div className="ab-chip" style={{ marginBottom: 10 }}>{t("system.probeHint")}</div>
            <div className="ab-stat-grid">
              <StatCard
                label={t("system.buildTime")}
                value={String((status.version as { adminApi?: string })?.adminApi ?? "-")}
                sub={String((status.version as { baseline?: string })?.baseline ?? "").slice(0, 12)}
              />
              <StatCard
                label={t("system.apiStatus")}
                value={(status.api as { ok?: boolean })?.ok ? t("dash.healthy") : t("dash.degraded")}
                tone={(status.api as { ok?: boolean })?.ok ? "ok" : "bad"}
                sub={String((status.api as { note?: string })?.note ?? "")}
              />
              <StatCard
                label={t("system.dbStatus")}
                value={dbOk ? t("system.connected") : t("dash.degraded")}
                tone={dbOk ? "ok" : "bad"}
                sub={dbLatency != null ? `${dbLatency}ms` : undefined}
              />
              <StatCard
                label={t("system.probeDb")}
                value={probes?.selectOne ? "SELECT 1 OK" : "FAIL"}
                tone={probes?.selectOne ? "ok" : "bad"}
              />
              <StatCard
                label={t("system.probeLedger")}
                value={probes?.ledgerQueryable ? "OK" : "FAIL"}
                tone={probes?.ledgerQueryable ? "ok" : "bad"}
              />
              <StatCard
                label={t("ledger.health")}
                value={(status.ledger as { ok?: boolean })?.ok ? t("ledger.healthOk") : t("ledger.healthIssues")}
                tone={(status.ledger as { ok?: boolean })?.ok ? "ok" : "bad"}
              />
              <StatCard
                label={t("system.openSessions")}
                value={String((status.sessions as { open?: number })?.open ?? 0)}
              />
              <StatCard
                label={t("system.pendingRounds")}
                value={String((status.rounds as { pending?: number })?.pending ?? 0)}
                tone={Number((status.rounds as { pending?: number })?.pending ?? 0) > 0 ? "bad" : "ok"}
              />
              <StatCard
                label={t("system.walletFailedToday")}
                value={String((status.wallet as { failedToday?: number })?.failedToday ?? 0)}
                tone={Number((status.wallet as { failedToday?: number })?.failedToday ?? 0) > 0 ? "bad" : "ok"}
              />
              <StatCard
                label={t("system.riskCritical")}
                value={String((status.risk as { critical?: number })?.critical ?? 0)}
                tone={Number((status.risk as { critical?: number })?.critical ?? 0) > 0 ? "bad" : "ok"}
              />
              <StatCard
                label={t("system.riskHigh")}
                value={String((status.risk as { high?: number })?.high ?? 0)}
                tone={Number((status.risk as { high?: number })?.high ?? 0) > 0 ? "bad" : "ok"}
              />
              <StatCard
                label={t("admins.activeCount")}
                value={String((status.admins as { active?: number })?.active ?? 0)}
              />
            </div>
          </>
        )
      ) : null}

      {tab === "config" ? (
        !config ? (
          <Loading text={t("common.loading")} />
        ) : (
          <div>
            <div className="ab-card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <b>{t("system.maintenanceMode")}</b>
                <Badge tone={maint ? "red" : "green"}>{maint ? t("system.on") : t("system.off")}</Badge>
                <button className="ab-btn" onClick={() => setConfirm({ kind: "maint", enabled: !maint })}>
                  {maint ? t("system.off") : t("system.on")}
                </button>
              </div>
            </div>
            <DataTable
              columns={[
                { key: "key", title: "Key", render: (row) => <span className="ab-mono">{row.key}</span> },
                { key: "value", title: "Value", render: (row) => <span className="ab-mono">{configValueText(row)}</span> },
                {
                  key: "updatedBy",
                  title: t("system.admin"),
                  render: (row) => String(row.updatedBy ?? row.updated_by ?? "-"),
                },
                {
                  key: "updatedAt",
                  title: t("common.updatedAt"),
                  render: (row) => {
                    const at = row.updatedAt ?? row.updated_at;
                    return at ? fmtTime(String(at)) : "-";
                  },
                },
              ]}
              rows={config}
              empty={t("common.empty")}
            />
          </div>
        )
      ) : null}

      {tab === "announcements" ? (
        !anns ? (
          <Loading text={t("common.loading")} />
        ) : (
          <div>
            <div className="ab-card" style={{ marginBottom: 12, display: "grid", gap: 8 }}>
              <b>{t("system.addAnnouncement")}</b>
              <div className="ab-chip">{t("system.annNoMigrationHint")}</div>
              <input
                className="ab-input"
                placeholder={t("system.announcementTitle")}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <textarea
                className="ab-input"
                placeholder={`${t("system.announcementContent")} (zh)`}
                value={newZh}
                onChange={(e) => setNewZh(e.target.value)}
                rows={2}
              />
              <textarea
                className="ab-input"
                placeholder={`${t("system.announcementContent")} (en)`}
                value={newEn}
                onChange={(e) => setNewEn(e.target.value)}
                rows={2}
              />
              <textarea
                className="ab-input"
                placeholder={`${t("system.announcementContent")} (my)`}
                value={newMy}
                onChange={(e) => setNewMy(e.target.value)}
                rows={2}
              />
              <label className="ab-chip" style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={asDraft} onChange={(e) => setAsDraft(e.target.checked)} />
                {t("system.annDraft")}
              </label>
              <input
                className="ab-input"
                type="datetime-local"
                value={newPublishAt}
                onChange={(e) => setNewPublishAt(e.target.value)}
                title={t("system.annSchedule")}
              />
              <button
                className="ab-btn primary"
                disabled={!newTitle || !(newZh || newEn || newMy)}
                onClick={() => setConfirm({ kind: "create-ann" })}
              >
                {t("common.submit")}
              </button>
            </div>
            <DataTable
              columns={[
                { key: "title", title: t("system.announcementTitle"), render: (row) => row.title },
                {
                  key: "content",
                  title: t("system.announcementContent"),
                  render: (row) => {
                    const parsed = parseAnnouncementContent(row.content);
                    const text = parsed[locale] || parsed.zh || parsed.en || parsed.my;
                    return text.slice(0, 48) + (text.length > 48 ? "…" : "");
                  },
                },
                {
                  key: "schedule",
                  title: t("system.annSchedule"),
                  render: (row) => parseAnnouncementContent(row.content).publishAt ?? "-",
                },
                {
                  key: "level",
                  title: t("system.level"),
                  render: (row) => <Badge tone={row.level === "CRITICAL" ? "red" : "blue"}>{row.level}</Badge>,
                },
                {
                  key: "status",
                  title: t("common.status"),
                  render: (row) => (
                    <Badge tone={row.status === "PUBLISHED" ? "green" : "gray"}>
                      {row.status === "PUBLISHED" ? t("system.published") : t("system.annDraft")}
                    </Badge>
                  ),
                },
                { key: "created_by", title: t("system.admin"), render: (row) => row.created_by },
                { key: "created_at", title: t("common.time"), render: (row) => fmtTime(row.created_at) },
                {
                  key: "actions",
                  title: t("common.actions"),
                  render: (row) => (
                    <button
                      className="ab-btn"
                      onClick={() =>
                        setConfirm({ kind: "ann", id: row.id, publish: row.status !== "PUBLISHED" })
                      }
                    >
                      {row.status === "PUBLISHED" ? t("system.unpublish") : t("system.publish")}
                    </button>
                  ),
                },
              ]}
              rows={anns}
              empty={t("common.empty")}
            />
          </div>
        )
      ) : null}

      {tab === "logs" ? (
        !logs ? (
          <Loading text={t("common.loading")} />
        ) : (
          <>
            <DataTable columns={logColumns} rows={logs.items} empty={t("common.empty")} />
            <Pagination page={page} pageSize={logs.pageSize} total={logs.total} onPage={setPage} />
          </>
        )
      ) : null}

      {confirm ? (
        <DangerConfirm
          title={
            confirm.kind === "maint"
              ? confirm.enabled
                ? t("system.maintenanceOnConfirm")
                : t("system.maintenanceOffConfirm")
              : confirm.kind === "create-ann"
                ? t("system.addAnnouncement")
                : confirm.publish
                  ? t("system.publish")
                  : t("system.unpublish")
          }
          description={t("common.dangerConfirm")}
          reasonLabel={t("common.reason")}
          reasonRequired={t("common.reasonRequired")}
          hint={t("common.dangerConfirmHint")}
          confirmLabel={t("common.confirm")}
          cancelLabel={t("common.cancel")}
          busy={busy}
          onConfirm={(reason) => void runConfirm(reason)}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}

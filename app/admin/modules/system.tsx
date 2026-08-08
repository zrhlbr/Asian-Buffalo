"use client";

/** R1-M7 — System: status, config, announcements, audit logs. */

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

type ConfigItem = { key: string; value_json: string; updated_by?: string | null; updated_at?: string; [key: string]: unknown };
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

export default function SystemModule() {
  const { t, api, toast } = useAdmin();
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
  const [newContent, setNewContent] = useState("");

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
        await api("system/announcements", {
          method: "POST",
          body: { title: newTitle, content: newContent, level: "INFO", reason },
        });
        setNewTitle("");
        setNewContent("");
      } else {
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
    try {
      return Boolean((JSON.parse(row.value_json) as { enabled?: boolean }).enabled);
    } catch {
      return false;
    }
  })();

  if (error && tab === "status" && !status) return <ErrorBox message={error} />;

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
            />
            <StatCard
              label={t("system.dbStatus")}
              value={(status.database as { ok?: boolean })?.ok ? t("system.connected") : t("dash.degraded")}
              tone={(status.database as { ok?: boolean })?.ok ? "ok" : "bad"}
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
            <StatCard
              label={t("admins.disabledCount")}
              value={String((status.admins as { disabled?: number })?.disabled ?? 0)}
            />
          </div>
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
                { key: "value_json", title: "Value", render: (row) => <span className="ab-mono">{row.value_json}</span> },
                { key: "updated_by", title: t("system.admin"), render: (row) => String(row.updated_by ?? "-") },
                {
                  key: "updated_at",
                  title: t("common.updatedAt"),
                  render: (row) => (row.updated_at ? fmtTime(String(row.updated_at)) : "-"),
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
              <input
                className="ab-input"
                placeholder={t("system.announcementTitle")}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <textarea
                className="ab-input"
                placeholder={t("system.announcementContent")}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={3}
              />
              <button
                className="ab-btn primary"
                disabled={!newTitle || !newContent}
                onClick={() => setConfirm({ kind: "create-ann" })}
              >
                {t("common.submit")}
              </button>
            </div>
            <DataTable
              columns={[
                { key: "title", title: t("system.announcementTitle"), render: (row) => row.title },
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
                      {row.status === "PUBLISHED" ? t("system.published") : t("system.unpublished")}
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

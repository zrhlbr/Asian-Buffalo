"use client";

/** ADMIN-1G Admin Security Center + sessions. */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DangerConfirm,
  DataTable,
  ErrorBox,
  Loading,
  StatCard,
  fmtTime,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type Overview = {
  adminLoginFailures: { availability: string };
  activeSessions: number;
  disabledAdmins: number;
  highPrivilegeRoles: { SUPER_ADMIN: number };
  recentPermissionChanges: {
    id: string;
    operator: string;
    action: string;
    targetId: string | null;
    createdAt: string;
  }[];
  bootstrap: { envVar: string; passwordExposed: boolean; note: string };
};

type SessionRow = {
  sessionIdMasked: string;
  tokenFingerprint: string;
  username: string;
  role: string;
  ipMasked: string | null;
  device: string;
  createdAt: string;
  status: string;
  isSelf: boolean;
};

export default function SecurityModule() {
  const { t, api, toast, can } = useAdmin();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [mine, setMine] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    { kind: "revoke"; fingerprint: string } | { kind: "logoutOthers" } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const canViewSessions = can("admins:sessions:view");
  const canRevoke = can("admins:sessions:revoke");

  const load = useCallback(async () => {
    try {
      const ov = await api<Overview>("security/overview");
      setOverview(ov);
      if (canViewSessions) {
        const all = await api<{ items: SessionRow[] }>("admins/sessions?pageSize=50");
        setSessions(all.items);
      }
      const mineRes = await api<{ items: SessionRow[] }>("admins/sessions/mine");
      setMine(mineRes.items);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, canViewSessions]);

  useEffect(() => {
    void load();
  }, [load]);

  const runConfirm = async (reason: string) => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "revoke") {
        await api("admins/sessions/revoke", {
          method: "POST",
          body: { reason, fingerprint: confirm.fingerprint },
        });
      } else {
        await api("admins/sessions/logout-others", {
          method: "POST",
          body: { reason },
        });
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

  const sessionCols: ColumnDef<SessionRow>[] = [
    { key: "id", title: t("security.sessionId"), render: (r) => r.sessionIdMasked },
    { key: "user", title: t("security.admin"), render: (r) => r.username },
    { key: "role", title: t("admins.role"), render: (r) => r.role },
    { key: "ip", title: "IP", render: (r) => r.ipMasked ?? "—" },
    { key: "device", title: t("security.device"), render: (r) => r.device },
    {
      key: "status",
      title: t("common.status"),
      render: (r) => (
        <Badge tone={r.status === "ACTIVE" ? "green" : "gray"}>{r.status}</Badge>
      ),
    },
    { key: "created", title: t("common.time"), render: (r) => fmtTime(r.createdAt) },
    {
      key: "actions",
      title: t("common.actions"),
      render: (r) =>
        canRevoke && r.status === "ACTIVE" ? (
          <button className="ab-btn" onClick={() => setConfirm({ kind: "revoke", fingerprint: r.tokenFingerprint })}>
            {t("security.revoke")}
          </button>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div>
      {error ? <ErrorBox message={error} /> : null}
      {!overview ? (
        <Loading text={t("common.loading")} />
      ) : (
        <>
          <div className="ab-stat-grid">
            <StatCard
              label={t("security.loginFailures")}
              value={overview.adminLoginFailures.availability}
              tone="warn"
            />
            <StatCard label={t("security.activeSessions")} value={String(overview.activeSessions)} />
            <StatCard label={t("security.disabledAdmins")} value={String(overview.disabledAdmins)} />
            <StatCard
              label="SUPER_ADMIN"
              value={String(overview.highPrivilegeRoles.SUPER_ADMIN)}
              tone="bad"
            />
          </div>
          <div className="ab-chip" style={{ marginBottom: 10 }}>
            {overview.bootstrap.envVar}: {overview.bootstrap.note}
          </div>
        </>
      )}

      <div className="ab-panel-title">{t("security.mySessions")}</div>
      <button className="ab-btn" style={{ marginBottom: 8 }} onClick={() => setConfirm({ kind: "logoutOthers" })}>
        {t("security.logoutOthers")}
      </button>
      {!mine ? <Loading text={t("common.loading")} /> : (
        <DataTable columns={sessionCols.filter((c) => c.key !== "user")} rows={mine} empty={t("common.empty")} />
      )}

      {canViewSessions ? (
        <>
          <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("security.allSessions")}</div>
          {!sessions ? <Loading text={t("common.loading")} /> : (
            <DataTable columns={sessionCols} rows={sessions} empty={t("common.empty")} />
          )}
        </>
      ) : null}

      {overview?.recentPermissionChanges?.length ? (
        <>
          <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("security.recentPermChanges")}</div>
          <DataTable
            columns={[
              { key: "t", title: t("common.time"), render: (r) => fmtTime(r.createdAt) },
              { key: "o", title: t("security.admin"), render: (r) => r.operator },
              { key: "a", title: t("system.action"), render: (r) => r.action },
              { key: "id", title: "Target", render: (r) => r.targetId?.slice(0, 12) ?? "—" },
            ]}
            rows={overview.recentPermissionChanges}
            empty={t("common.empty")}
          />
        </>
      ) : null}

      {confirm ? (
        <DangerConfirm
          title={confirm.kind === "revoke" ? t("security.revoke") : t("security.logoutOthers")}
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

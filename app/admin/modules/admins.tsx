"use client";

/** R1-M7 — Admins: list + create + role/status/password (audited mutations). */

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

type AdminRow = {
  id: string;
  username: string;
  role: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
  op_count?: number;
  risk_op_count?: number;
  last_login_ip?: string | null;
  [key: string]: unknown;
};

type AdminStats = {
  active: number;
  disabled: number;
  total: number;
  byRole: Record<string, number>;
  auditTotal: number;
  riskOpTotal: number;
};

type MatrixPayload = {
  permissions: string[];
  dangerous: string[];
  roles: { role: string; grants: string[] }[];
};

const ROLES = [
  "SUPER_ADMIN",
  "OPS",
  "SUPPORT",
  "FINANCE",
  "RISK",
  "AUDIT",
  "TECH",
  "READONLY",
] as const;

export default function AdminsModule() {
  const { t, api, toast, me } = useAdmin();
  const [items, setItems] = useState<AdminRow[] | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [matrix, setMatrix] = useState<MatrixPayload | null>(null);
  const [auditFor, setAuditFor] = useState<{ id: string; items: Record<string, unknown>[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<
    | { kind: "disable" | "enable"; id: string }
    | { kind: "change_role"; id: string; role: string }
    | { kind: "reset_password"; id: string; password: string }
    | { kind: "create" }
    | null
  >(null);
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState<string>("OPS");
  const [rolePick, setRolePick] = useState("OPS");
  const [passPick, setPassPick] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [result, statsResult, matrixResult] = await Promise.all([
        api<{ items: AdminRow[] }>("admins"),
        api<AdminStats>("admins/stats"),
        api<MatrixPayload>("admins/matrix"),
      ]);
      setItems(result.items);
      setStats(statsResult);
      setMatrix(matrixResult);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const runConfirm = async (reason: string) => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "create") {
        await api("admins", {
          method: "POST",
          body: { username: newUser, password: newPass, role: newRole, reason },
        });
        setNewUser("");
        setNewPass("");
      } else if (confirm.kind === "disable" || confirm.kind === "enable") {
        await api(`admins/${encodeURIComponent(confirm.id)}`, {
          method: "POST",
          body: { action: confirm.kind, reason },
        });
      } else if (confirm.kind === "change_role") {
        await api(`admins/${encodeURIComponent(confirm.id)}`, {
          method: "POST",
          body: { action: "change_role", role: confirm.role, reason },
        });
      } else {
        await api(`admins/${encodeURIComponent(confirm.id)}`, {
          method: "POST",
          body: { action: "reset_password", password: confirm.password, reason },
        });
      }
      toast(t("common.success"));
      setConfirm(null);
      setPendingId(null);
      await load();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<AdminRow>[] = [
    { key: "username", title: t("login.username"), render: (row) => <b>{row.username}</b> },
    { key: "role", title: t("admins.role"), render: (row) => <Badge tone="purple">{row.role}</Badge> },
    {
      key: "status",
      title: t("common.status"),
      render: (row) => (
        <Badge tone={row.status === "ACTIVE" ? "green" : "red"}>
          {row.status === "ACTIVE" ? t("admins.enabled") : t("admins.disabled")}
        </Badge>
      ),
    },
    {
      key: "op_count",
      title: t("admins.opCount"),
      render: (row) => String(row.op_count ?? 0),
    },
    {
      key: "risk_op_count",
      title: t("admins.riskOpCount"),
      render: (row) => String(row.risk_op_count ?? 0),
    },
    {
      key: "last_login_at",
      title: t("admins.lastLoginAt"),
      render: (row) => (row.last_login_at ? fmtTime(row.last_login_at) : "-"),
    },
    { key: "created_at", title: t("common.createdAt"), render: (row) => fmtTime(row.created_at) },
    {
      key: "actions",
      title: t("common.actions"),
      render: (row) => {
        const self = me?.id === row.id;
        return (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              className="ab-btn"
              onClick={() =>
                void api<{ items: Record<string, unknown>[] }>(`admins/${encodeURIComponent(row.id)}/audit`)
                  .then((res) => setAuditFor({ id: row.id, items: res.items }))
                  .catch(() => undefined)
              }
            >
              {t("admins.recentAudit")}
            </button>
            <button
              className="ab-btn"
              disabled={self}
              onClick={() => setConfirm({ kind: row.status === "ACTIVE" ? "disable" : "enable", id: row.id })}
            >
              {row.status === "ACTIVE" ? t("admins.disable") : t("admins.enable")}
            </button>
            <button
              className="ab-btn"
              disabled={self}
              onClick={() => {
                setPendingId(row.id);
                setRolePick(row.role);
              }}
            >
              {t("admins.changeRole")}
            </button>
            <button
              className="ab-btn"
              onClick={() => {
                setPendingId(row.id);
                setPassPick("");
              }}
            >
              {t("admins.resetPassword")}
            </button>
          </div>
        );
      },
    },
  ];

  if (error && !items) return <ErrorBox message={error} />;
  if (!items) return <Loading text={t("common.loading")} />;

  return (
    <div>
      <div className="ab-chip" style={{ marginBottom: 12 }}>
        {t("admins.auditHint")}
      </div>

      {stats ? (
        <div className="ab-stat-grid" style={{ marginBottom: 16 }}>
          <StatCard label={t("admins.stats")} value={String(stats.total)} />
          <StatCard label={t("admins.activeCount")} value={String(stats.active)} tone="ok" />
          <StatCard label={t("admins.disabledCount")} value={String(stats.disabled)} />
          <StatCard label={t("admins.opCount")} value={String(stats.auditTotal)} />
          <StatCard label={t("admins.riskOpCount")} value={String(stats.riskOpTotal)} tone={stats.riskOpTotal > 0 ? "bad" : "ok"} />
        </div>
      ) : null}

      {matrix ? (
        <div className="ab-panel" style={{ marginBottom: 16 }}>
          <div className="ab-panel-title">{t("admins.matrix")}</div>
          <div className="ab-table-wrap">
            <table className="ab-table">
              <thead>
                <tr>
                  <th>{t("admins.role")}</th>
                  <th>{t("common.total")}</th>
                  <th>Dangerous</th>
                </tr>
              </thead>
              <tbody>
                {matrix.roles.map((row) => (
                  <tr key={row.role}>
                    <td><Badge tone="purple">{row.role}</Badge></td>
                    <td>{row.grants.length}</td>
                    <td>{row.grants.filter((g) => matrix.dangerous.includes(g)).join(", ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {auditFor ? (
        <div className="ab-panel" style={{ marginBottom: 16 }}>
          <div className="ab-panel-title">
            {t("admins.recentAudit")} · <span className="ab-mono">{auditFor.id.slice(0, 8)}…</span>
            <button className="ab-btn" style={{ marginLeft: 8 }} onClick={() => setAuditFor(null)}>
              {t("common.close")}
            </button>
          </div>
          <DataTable
            columns={[
              { key: "created_at", title: t("common.time"), render: (row) => fmtTime(String(row.created_at ?? "")) },
              { key: "action", title: "Action", render: (row) => <span className="ab-mono">{String(row.action)}</span> },
              { key: "reason", title: t("common.reason"), render: (row) => String(row.reason ?? "-") },
              { key: "ip", title: t("common.ip"), render: (row) => String(row.ip ?? "-") },
            ]}
            rows={auditFor.items}
            empty={t("common.empty")}
          />
        </div>
      ) : null}

      <div className="ab-card" style={{ marginBottom: 16, display: "grid", gap: 8 }}>
        <b>{t("admins.add")}</b>
        <input
          className="ab-input"
          placeholder={t("login.username")}
          value={newUser}
          onChange={(e) => setNewUser(e.target.value)}
        />
        <input
          className="ab-input"
          type="password"
          placeholder={t("login.password")}
          value={newPass}
          onChange={(e) => setNewPass(e.target.value)}
        />
        <select className="ab-input" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <button
          className="ab-btn primary"
          disabled={!newUser || newPass.length < 8}
          onClick={() => setConfirm({ kind: "create" })}
        >
          {t("admins.add")}
        </button>
      </div>

      {pendingId ? (
        <div className="ab-card" style={{ marginBottom: 16, display: "grid", gap: 8 }}>
          <b>
            {t("admins.changeRole")} / {t("admins.resetPassword")} · {pendingId.slice(0, 8)}…
          </b>
          <select className="ab-input" value={rolePick} onChange={(e) => setRolePick(e.target.value)}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button
            className="ab-btn"
            onClick={() => setConfirm({ kind: "change_role", id: pendingId, role: rolePick })}
          >
            {t("admins.changeRole")}
          </button>
          <input
            className="ab-input"
            type="password"
            placeholder={t("admins.newPassword")}
            value={passPick}
            onChange={(e) => setPassPick(e.target.value)}
          />
          <button
            className="ab-btn"
            disabled={passPick.length < 8}
            onClick={() => setConfirm({ kind: "reset_password", id: pendingId, password: passPick })}
          >
            {t("admins.resetPassword")}
          </button>
          <button className="ab-btn" onClick={() => setPendingId(null)}>
            {t("common.cancel")}
          </button>
        </div>
      ) : null}

      <DataTable columns={columns} rows={items} empty={t("common.empty")} />

      {confirm ? (
        <DangerConfirm
          title={
            confirm.kind === "create"
              ? t("admins.add")
              : confirm.kind === "disable"
                ? t("admins.confirmDisable")
                : confirm.kind === "enable"
                  ? t("admins.confirmEnable")
                  : confirm.kind === "change_role"
                    ? t("admins.confirmRole")
                    : t("admins.confirmReset")
          }
          description={t("admins.auditHint")}
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

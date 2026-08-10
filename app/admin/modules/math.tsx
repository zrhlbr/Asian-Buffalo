"use client";

/** R1-M9 — Math versions: list + RTP/usage detail (read-only). */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DataTable,
  ErrorBox,
  Loading,
  ReadonlyBanner,
  StatCard,
  fmtTime,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type MathRow = {
  id: string;
  sha256: string;
  status: string;
  activated_at: string | null;
  created_at: string;
  summary?: { rtp?: number | null; paylineCount?: number | null; gameVersion?: string | null };
  sessionCount?: number;
  roundCount?: number;
  [key: string]: unknown;
};

type MathDetail = MathRow & {
  config?: Record<string, unknown> | null;
  sessionCount?: number;
  roundCount?: number;
};

function statusTone(status: string): "green" | "amber" | "gray" {
  if (status === "FROZEN") return "green";
  if (status === "DRAFT") return "amber";
  return "gray";
}

function rtpOf(row: MathRow | MathDetail): string {
  const fromSummary = row.summary?.rtp;
  const fromConfig = row.config && (row.config.theoreticalRtp ?? row.config.rtp);
  const value = fromSummary ?? fromConfig;
  return typeof value === "number" ? `${value}%` : value != null ? String(value) : "-";
}

export default function MathModule() {
  const { t, api } = useAdmin();
  const [items, setItems] = useState<MathRow[] | null>(null);
  const [detail, setDetail] = useState<MathDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api<{ items: MathRow[] }>("math-versions");
      setItems(result.items);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: string) => {
    try {
      setDetail(await api<MathDetail>(`math-versions/${encodeURIComponent(id)}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const columns: ColumnDef<MathRow>[] = [
    { key: "id", title: t("common.id"), render: (row) => <span className="ab-mono">{row.id}</span> },
    { key: "sha256", title: t("math.sha256"), render: (row) => <span className="ab-mono">{row.sha256.slice(0, 16)}…</span> },
    {
      key: "status",
      title: t("common.status"),
      render: (row) => (
        <Badge tone={statusTone(row.status)}>
          {row.status === "FROZEN" ? t("math.frozen") : row.status === "DRAFT" ? t("math.draft") : t("math.retired")}
        </Badge>
      ),
    },
    { key: "rtp", title: t("math.rtp"), render: (row) => rtpOf(row) },
    { key: "sessionCount", title: t("math.sessionUsage"), render: (row) => String(row.sessionCount ?? 0) },
    { key: "roundCount", title: t("math.roundUsage"), render: (row) => String(row.roundCount ?? 0) },
    { key: "activated_at", title: t("math.activatedAt"), render: (row) => row.activated_at ? fmtTime(row.activated_at) : "-" },
    { key: "created_at", title: t("common.createdAt"), render: (row) => fmtTime(row.created_at) },
    {
      key: "actions",
      title: t("common.actions"),
      render: (row) => (
        <button className="ab-btn" onClick={() => void openDetail(row.id)}>{t("common.detail")}</button>
      ),
    },
  ];

  if (error && !items) return <ErrorBox message={error} />;
  if (!items) return <Loading text={t("common.loading")} />;

  if (detail) {
    return (
      <div>
        <ReadonlyBanner text={t("math.readonlyHint")} />
        <div className="ab-toolbar">
          <button className="ab-btn" onClick={() => setDetail(null)}>{t("common.back")}</button>
          <span className="ab-chip"><b>{detail.id}</b></span>
          <Badge tone={statusTone(String(detail.status))}>{String(detail.status)}</Badge>
        </div>
        <div className="ab-stat-grid">
          <StatCard label={t("math.rtp")} value={rtpOf(detail)} />
          <StatCard label={t("math.sessionUsage")} value={String(detail.sessionCount ?? 0)} />
          <StatCard label={t("math.roundUsage")} value={String(detail.roundCount ?? 0)} />
          <StatCard
            label={t("math.paylineCount")}
            value={String((detail.config as { paylineCount?: number } | null)?.paylineCount ?? "-")}
          />
        </div>
        <div className="ab-card" style={{ marginTop: 12 }}>
          <div><b>{t("math.sha256")}:</b> <span className="ab-mono">{String(detail.sha256)}</span></div>
          <div><b>{t("math.activatedAt")}:</b> {detail.activated_at ? fmtTime(String(detail.activated_at)) : "-"}</div>
          <pre className="ab-pre" style={{ marginTop: 12, maxHeight: 420, overflow: "auto" }}>
            {JSON.stringify(detail.config ?? detail, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ReadonlyBanner text={t("math.readonlyHint")} />
      <div className="ab-toolbar">
        <button className="ab-btn" onClick={() => void load()}>⟳ {t("common.refresh")}</button>
      </div>
      <DataTable columns={columns} rows={items} empty={t("common.empty")} />
    </div>
  );
}

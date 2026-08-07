"use client";

/** R1-M7 — Risk control: signal list + summary (read-only). */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DataTable,
  ErrorBox,
  Loading,
  StatCard,
  fmtTime,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type Signal = {
  id?: string;
  level: string;
  type: string;
  playerId?: string | null;
  evidence?: string | null;
  detectedAt?: string | null;
  [key: string]: unknown;
};

type RiskPayload = {
  summary: { total: number; critical: number; high: number; medium: number; low: number };
  items: Signal[];
};

function levelTone(level: string): "red" | "amber" | "blue" | "gray" {
  if (level === "CRITICAL") return "red";
  if (level === "HIGH") return "amber";
  if (level === "MEDIUM") return "blue";
  return "gray";
}

export default function RiskModule() {
  const { t, api } = useAdmin();
  const [level, setLevel] = useState("");
  const [type, setType] = useState("");
  const [data, setData] = useState<RiskPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (level) params.set("level", level);
      if (type) params.set("type", type);
      const qs = params.toString();
      setData(await api<RiskPayload>(`risk/signals${qs ? `?${qs}` : ""}`));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, level, type]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnDef<Signal>[] = [
    {
      key: "level",
      title: t("risk.level"),
      render: (row) => <Badge tone={levelTone(row.level)}>{row.level}</Badge>,
    },
    { key: "type", title: t("risk.signalType"), render: (row) => <span className="ab-mono">{row.type}</span> },
    {
      key: "playerId",
      title: t("risk.relatedPlayer"),
      render: (row) => row.playerId ? <span className="ab-mono">{row.playerId.slice(0, 12)}…</span> : "-",
    },
    { key: "evidence", title: t("risk.evidence"), render: (row) => String(row.evidence ?? "-").slice(0, 80) },
    { key: "detectedAt", title: t("risk.detectedAt"), render: (row) => row.detectedAt ? fmtTime(row.detectedAt) : "-" },
  ];

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Loading text={t("common.loading")} />;

  return (
    <div>
      <div className="ab-toolbar">
        <select className="ab-input" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">{t("risk.allLevels")}</option>
          <option value="CRITICAL">{t("risk.levelCritical")}</option>
          <option value="HIGH">{t("risk.levelHigh")}</option>
          <option value="MEDIUM">{t("risk.levelMedium")}</option>
          <option value="LOW">{t("risk.levelLow")}</option>
        </select>
        <input
          className="ab-input"
          placeholder={t("risk.signalType")}
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
        <button className="ab-btn" onClick={() => void load()}>⟳ {t("common.refresh")}</button>
      </div>

      <div className="ab-stat-grid">
        <StatCard label={t("risk.signalCount")} value={String(data.summary.total)} />
        <StatCard label={t("risk.levelCritical")} value={String(data.summary.critical)} tone={data.summary.critical ? "bad" : "ok"} />
        <StatCard label={t("risk.levelHigh")} value={String(data.summary.high)} tone={data.summary.high ? "bad" : "ok"} warn={data.summary.high > 0} />
        <StatCard label={t("risk.levelMedium")} value={String(data.summary.medium)} />
        <StatCard label={t("risk.levelLow")} value={String(data.summary.low)} />
      </div>

      <DataTable columns={columns} rows={data.items} empty={t("common.empty")} />
    </div>
  );
}

"use client";

/** R1-M9 — Ops reports (read-only aggregations). */

import React, { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  ErrorBox,
  Loading,
  StatCard,
  fmtMinor,
  useAdmin,
} from "../admin-ui.tsx";

type OpsReport = {
  generatedAt: string;
  summary: {
    onlineNow: number;
    todayActive: number;
    spinCount: number;
    todayBetMinor: number;
    todayPayoutMinor: number;
    todayProfitMinor: number;
    rtpPercent: number | null;
    anomalyCount: number;
  };
  hourly: { hour: string; spins: number; betMinor: number; payoutMinor: number }[];
  roundStatus: { status: string; count: number }[];
  topPlayers: { playerId: string; spinCount: number; totalBetMinor: number; totalWinMinor: number }[];
  health: { wallet: boolean; ledger: boolean; api: boolean; system: boolean };
};

export default function ReportsModule() {
  const { t, api } = useAdmin();
  const [data, setData] = useState<OpsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<OpsReport>("reports/ops"));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Loading text={t("common.loading")} />;

  return (
    <div>
      <div className="ab-toolbar">
        <button className="ab-btn" onClick={() => void load()}>⟳ {t("common.refresh")}</button>
        <span className="ab-chip">{t("reports.generatedAt")}: {new Date(data.generatedAt).toLocaleString()}</span>
      </div>
      {error ? <ErrorBox message={error} /> : null}
      <div className="ab-grid-stats">
        <StatCard label={t("dash.onlineNow")} value={String(data.summary.onlineNow)} />
        <StatCard label={t("dash.todayActive")} value={String(data.summary.todayActive)} />
        <StatCard label={t("dash.spinCount")} value={String(data.summary.spinCount)} />
        <StatCard label={t("reports.bet")} value={fmtMinor(data.summary.todayBetMinor)} />
        <StatCard label={t("reports.payout")} value={fmtMinor(data.summary.todayPayoutMinor)} />
        <StatCard label={t("reports.profit")} value={fmtMinor(data.summary.todayProfitMinor)} />
        <StatCard
          label={t("reports.rtp")}
          value={data.summary.rtpPercent == null ? "-" : `${data.summary.rtpPercent.toFixed(2)}%`}
        />
        <StatCard
          label={t("dash.anomalyCount")}
          value={String(data.summary.anomalyCount)}
          tone={data.summary.anomalyCount > 0 ? "bad" : "ok"}
        />
      </div>
      <div className="ab-chart-grid" style={{ marginTop: 16 }}>
        <div className="ab-panel">
          <div className="ab-panel-title">{t("dash.hourlySpins")}</div>
          <BarChart
            groups={data.hourly.map((row) => ({
              label: row.hour.slice(-5),
              values: [{ name: t("dash.spinCount"), value: row.spins }],
            }))}
          />
        </div>
        <div className="ab-panel">
          <div className="ab-panel-title">{t("dash.roundStatusDist")}</div>
          <BarChart
            groups={data.roundStatus.map((row) => ({
              label: row.status,
              values: [{ name: t("common.total"), value: row.count }],
            }))}
          />
        </div>
      </div>
      <div className="ab-panel" style={{ marginTop: 16 }}>
        <div className="ab-panel-title">{t("reports.topPlayers")}</div>
        <div className="ab-table-wrap">
          <table className="ab-table">
            <thead>
              <tr>
                <th>{t("rounds.playerId")}</th>
                <th>{t("dash.spinCount")}</th>
                <th>{t("reports.bet")}</th>
                <th>{t("reports.payout")}</th>
              </tr>
            </thead>
            <tbody>
              {data.topPlayers.length === 0 ? (
                <tr><td colSpan={4}>{t("common.empty")}</td></tr>
              ) : (
                data.topPlayers.map((row) => (
                  <tr key={row.playerId}>
                    <td className="ab-mono">{row.playerId.slice(0, 12)}…</td>
                    <td>{row.spinCount}</td>
                    <td>{fmtMinor(row.totalBetMinor)}</td>
                    <td>{fmtMinor(row.totalWinMinor)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="ab-chip" style={{ marginTop: 12 }}>
        Wallet {data.health.wallet ? "OK" : "BAD"} · Ledger {data.health.ledger ? "OK" : "BAD"} · API{" "}
        {data.health.api ? "OK" : "BAD"}
      </div>
    </div>
  );
}

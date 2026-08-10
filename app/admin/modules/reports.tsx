"use client";

/** R1-M9 — Ops reports: DAU/MAU/retention/rankings (read-only). */

import React, { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  ErrorBox,
  Loading,
  StatCard,
  fmtMinor,
  useAdmin,
} from "../admin-ui.tsx";

type RankRow = {
  playerId: string;
  spinCount: number;
  totalBetMinor: number;
  totalWinMinor: number;
  profitMinor?: number;
};

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
    dau?: number;
    mau?: number;
  };
  retention?: {
    d1: { cohort: number; retained: number; rate: number | null };
    d7: { cohort: number; retained: number; rate: number | null };
  };
  hourly: { hour: string; spins: number; betMinor: number; payoutMinor: number }[];
  roundStatus: { status: string; count: number }[];
  topPlayers: RankRow[];
  rankings?: { byBet: RankRow[]; byWin: RankRow[]; byProfit: RankRow[] };
  health: { wallet: boolean; ledger: boolean; api: boolean; system: boolean };
};

export default function ReportsModule() {
  const { t, api } = useAdmin();
  const [data, setData] = useState<OpsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rankTab, setRankTab] = useState<"byBet" | "byWin" | "byProfit">("byBet");

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

  const ranks = data.rankings?.[rankTab] ?? data.topPlayers;

  return (
    <div>
      <div className="ab-toolbar">
        <button className="ab-btn" onClick={() => void load()}>⟳ {t("common.refresh")}</button>
        <span className="ab-chip">{t("reports.generatedAt")}: {new Date(data.generatedAt).toLocaleString()}</span>
      </div>
      {error ? <ErrorBox message={error} /> : null}
      <div className="ab-grid-stats">
        <StatCard label={t("dash.onlineNow")} value={String(data.summary.onlineNow)} />
        <StatCard label={t("reports.dau")} value={String(data.summary.dau ?? data.summary.todayActive)} />
        <StatCard label={t("reports.mau")} value={String(data.summary.mau ?? "-")} />
        <StatCard label={t("dash.spinCount")} value={String(data.summary.spinCount)} />
        <StatCard label={t("reports.bet")} value={fmtMinor(data.summary.todayBetMinor)} />
        <StatCard label={t("reports.payout")} value={fmtMinor(data.summary.todayPayoutMinor)} />
        <StatCard label={t("reports.profit")} value={fmtMinor(data.summary.todayProfitMinor)} />
        <StatCard
          label={t("reports.rtp")}
          value={data.summary.rtpPercent == null ? "-" : `${data.summary.rtpPercent.toFixed(2)}%`}
        />
        <StatCard
          label={t("reports.retentionD1")}
          value={
            data.retention?.d1.rate == null ? "-" : `${data.retention.d1.rate.toFixed(1)}%`
          }
          sub={data.retention ? `${data.retention.d1.retained}/${data.retention.d1.cohort}` : undefined}
        />
        <StatCard
          label={t("reports.retentionD7")}
          value={
            data.retention?.d7.rate == null ? "-" : `${data.retention.d7.rate.toFixed(1)}%`
          }
          sub={data.retention ? `${data.retention.d7.retained}/${data.retention.d7.cohort}` : undefined}
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
        <div className="ab-panel-title">{t("reports.rankings")}</div>
        <div className="ab-toolbar">
          {([
            ["byBet", "reports.rankByBet"],
            ["byWin", "reports.rankByWin"],
            ["byProfit", "reports.rankByProfit"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              className={`ab-btn${rankTab === key ? " primary" : ""}`}
              onClick={() => setRankTab(key)}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <div className="ab-table-wrap">
          <table className="ab-table">
            <thead>
              <tr>
                <th>{t("rounds.playerId")}</th>
                <th>{t("dash.spinCount")}</th>
                <th>{t("reports.bet")}</th>
                <th>{t("reports.payout")}</th>
                <th>{t("reports.profit")}</th>
              </tr>
            </thead>
            <tbody>
              {ranks.length === 0 ? (
                <tr><td colSpan={5}>{t("common.empty")}</td></tr>
              ) : (
                ranks.map((row) => (
                  <tr key={`${rankTab}-${row.playerId}`}>
                    <td className="ab-mono">{row.playerId.slice(0, 12)}…</td>
                    <td>{row.spinCount}</td>
                    <td>{fmtMinor(row.totalBetMinor)}</td>
                    <td>{fmtMinor(row.totalWinMinor)}</td>
                    <td>{fmtMinor(row.profitMinor ?? row.totalBetMinor - row.totalWinMinor)}</td>
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

"use client";

/** Rankings — Win / Bet / Profit from reports/ops (read-only, no forge). */

import React, { useCallback, useEffect, useState } from "react";
import { ErrorBox, Loading, fmtMinor, useAdmin } from "../admin-ui.tsx";

type RankRow = {
  playerId: string;
  spinCount: number;
  totalBetMinor: number;
  totalWinMinor: number;
  profitMinor?: number;
};

type OpsReport = {
  generatedAt: string;
  rankings?: { byBet: RankRow[]; byWin: RankRow[]; byProfit: RankRow[] };
  topPlayers?: RankRow[];
};

export default function RankingsModule() {
  const { t, api } = useAdmin();
  const [data, setData] = useState<OpsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"byWin" | "byBet" | "byProfit">("byWin");

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

  const ranks = data.rankings?.[tab] ?? data.topPlayers ?? [];

  return (
    <div>
      <div className="ab-toolbar">
        <button className="ab-btn" onClick={() => void load()}>
          ⟳ {t("common.refresh")}
        </button>
        <span className="ab-chip">
          {t("reports.generatedAt")}: {new Date(data.generatedAt).toLocaleString()}
        </span>
      </div>
      {error ? <ErrorBox message={error} /> : null}
      <div className="ab-panel">
        <div className="ab-panel-title">{t("reports.rankings")}</div>
        <div className="ab-toolbar">
          {(
            [
              ["byWin", "reports.rankByWin"],
              ["byBet", "reports.rankByBet"],
              ["byProfit", "reports.rankByProfit"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`ab-btn${tab === key ? " primary" : ""}`}
              onClick={() => setTab(key)}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <div className="ab-table-wrap">
          <table className="ab-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("rounds.playerId")}</th>
                <th>{t("dash.spinCount")}</th>
                <th>{t("reports.bet")}</th>
                <th>{t("reports.payout")}</th>
                <th>{t("reports.profit")}</th>
              </tr>
            </thead>
            <tbody>
              {ranks.length === 0 ? (
                <tr>
                  <td colSpan={6}>{t("common.empty")}</td>
                </tr>
              ) : (
                ranks.map((row, index) => (
                  <tr key={`${tab}-${row.playerId}`}>
                    <td>{index + 1}</td>
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
    </div>
  );
}

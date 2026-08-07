"use client";

/** R1-M7 — Dashboard: live operations metrics with auto refresh. */

import React, { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  ErrorBox,
  LineChart,
  Loading,
  PieChart,
  StatCard,
  fmtMinor,
  fmtTime,
  useAdmin,
} from "../admin-ui.tsx";

type DashboardData = {
  onlineNow: number;
  todayActive: number;
  todayNew: number;
  spinCount: number;
  todayBetMinor: number;
  todayPayoutMinor: number;
  todayProfitMinor: number;
  rtpPercent: number | null;
  freeSpinsNow: number;
  anomalyCount: number;
  wallet: { byStatus: { status: string; count: number }[]; ok: boolean };
  ledger: { ok: boolean; unbalancedTx: number; projectionMismatch: number };
  api: { ok: boolean };
  system: { ok: boolean; checkedAt: string };
  hourly: { hour: string; spins: number; betMinor: number; payoutMinor: number }[];
  roundStatus: { status: string; count: number }[];
};

export default function DashboardModule() {
  const { t, api } = useAdmin();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const result = await api<DashboardData>("dashboard");
      setData(result);
      setError(null);
      setUpdatedAt(new Date().toLocaleTimeString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, [auto, load]);

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Loading text={t("common.loading")} />;

  const healthTone = (ok: boolean) => (ok ? ("ok" as const) : ("bad" as const));

  return (
    <div>
      <div className="ab-toolbar">
        <button className="ab-btn" onClick={() => void load()}>⟳ {t("common.refresh")}</button>
        <label className="ab-chip" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} />
          {t("common.autoRefresh")} (10s)
        </label>
        <span className="ab-chip">{t("common.updatedAt")}: <b>{updatedAt || "-"}</b></span>
      </div>

      <div className="ab-grid-stats">
        <StatCard label={t("dash.onlineNow")} value={data.onlineNow} />
        <StatCard label={t("dash.todayActive")} value={data.todayActive} />
        <StatCard label={t("dash.todayNew")} value={data.todayNew} />
        <StatCard label={t("dash.spinCount")} value={data.spinCount.toLocaleString()} />
        <StatCard label={t("dash.todayBet")} value={fmtMinor(data.todayBetMinor)} />
        <StatCard label={t("dash.todayPayout")} value={fmtMinor(data.todayPayoutMinor)} />
        <StatCard
          label={t("dash.todayProfit")}
          value={fmtMinor(data.todayProfitMinor)}
          tone={data.todayProfitMinor >= 0 ? "ok" : "bad"}
        />
        <StatCard
          label={t("dash.rtp")}
          value={data.rtpPercent == null ? "-" : `${data.rtpPercent.toFixed(2)}%`}
        />
        <StatCard label={t("dash.freeSpinsNow")} value={data.freeSpinsNow} />
        <StatCard
          label={t("dash.anomalyCount")}
          value={data.anomalyCount}
          warn={data.anomalyCount > 0}
          tone={data.anomalyCount > 0 ? "bad" : "ok"}
        />
        <StatCard
          label={t("dash.walletStatus")}
          value={data.wallet.ok ? t("dash.healthy") : t("dash.degraded")}
          tone={healthTone(data.wallet.ok)}
        />
        <StatCard
          label={t("dash.ledgerStatus")}
          value={data.ledger.ok ? t("dash.healthy") : t("dash.degraded")}
          tone={healthTone(data.ledger.ok)}
          sub={!data.ledger.ok ? `tx:${data.ledger.unbalancedTx} proj:${data.ledger.projectionMismatch}` : undefined}
        />
        <StatCard label={t("dash.apiStatus")} value={data.api.ok ? t("dash.healthy") : t("dash.degraded")} tone={healthTone(data.api.ok)} />
        <StatCard
          label={t("dash.systemHealth")}
          value={data.system.ok ? t("dash.healthy") : t("dash.degraded")}
          tone={healthTone(data.system.ok)}
          sub={fmtTime(data.system.checkedAt)}
        />
      </div>

      <div className="ab-chart-grid">
        <div className="ab-panel">
          <div className="ab-panel-title">{t("dash.spinsTrend")} · {t("dash.last24h")}</div>
          <LineChart
            series={[
              {
                name: t("dash.hourlySpins"),
                points: data.hourly.map((row) => ({ x: row.hour, y: row.spins })),
              },
            ]}
          />
        </div>
        <div className="ab-panel">
          <div className="ab-panel-title">{t("dash.betVsPayout")} · {t("dash.last24h")}</div>
          <BarChart
            groups={data.hourly.map((row) => ({
              label: row.hour,
              values: [
                { name: t("rounds.betAmount"), value: row.betMinor },
                { name: t("rounds.winAmount"), value: row.payoutMinor, color: "#34d399" },
              ],
            }))}
          />
        </div>
        <div className="ab-panel">
          <div className="ab-panel-title">{t("dash.intentStatusDist")}</div>
          <PieChart data={data.wallet.byStatus.map((row) => ({ name: row.status, value: row.count }))} />
        </div>
        <div className="ab-panel">
          <div className="ab-panel-title">{t("dash.roundStatusDist")}</div>
          <PieChart
            data={data.roundStatus.map((row) => ({ name: row.status, value: row.count }))}
          />
        </div>
      </div>
    </div>
  );
}

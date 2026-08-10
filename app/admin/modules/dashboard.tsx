"use client";

/** ADMIN-1B — Dashboard: real ops metrics, availability-aware cells, 7d trends. */

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

type MetricCell = {
  value: number | null;
  availability: "OK" | "NOT_AVAILABLE" | "ERROR";
  source: string;
  error?: string;
};

type DashboardData = {
  metrics?: {
    totalPlayers: MetricCell;
    todayNew: MetricCell;
    onlineNow: MetricCell;
    todayLoginPlayers: MetricCell;
    todayActivePlayers: MetricCell;
    todayGamePlayers: MetricCell;
    todayRounds: MetricCell;
    todaySpins: MetricCell;
    todayBetMinor: MetricCell;
    todayPayoutMinor: MetricCell;
    todayProfitMinor: MetricCell;
  };
  moneyMetrics?: {
    todayDepositCount: MetricCell;
    todayWithdrawCount: MetricCell;
    pendingDepositCount: MetricCell;
    pendingWithdrawCount: MetricCell;
  };
  moneyGate?: {
    productionMoney: boolean;
    providerConfigured: boolean;
    realMoneyProvider: string;
    gate: string;
  };
  sources?: Record<string, string>;
  cached?: boolean;
  onlineNow: number;
  todayActive: number;
  todayNew: number;
  totalPlayers?: number;
  spinCount: number;
  todayBetMinor: number;
  todayPayoutMinor: number;
  todayProfitMinor: number;
  rtpPercent: number | null;
  freeSpinsNow: number;
  anomalyCount: number;
  todayDepositCount?: number;
  todayWithdrawCount?: number;
  pendingDepositCount?: number;
  pendingWithdrawCount?: number;
  openRoundCount?: number;
  wallet: { byStatus: { status: string; count: number }[]; ok: boolean };
  ledger: { ok: boolean; unbalancedTx: number; projectionMismatch: number };
  api: { ok: boolean; probed?: boolean };
  system: { ok: boolean; probed?: boolean; checkedAt: string };
  hourly: { hour: string; spins: number; betMinor: number; payoutMinor: number }[];
  roundStatus: { status: string; count: number }[];
  byCurrency: { currency: string; spins: number; betMinor: number; payoutMinor: number }[];
  sparklineSpins: number[];
  trend7d?: {
    day: string;
    activePlayers: number;
    newPlayers: number;
    gamePlayers?: number;
    rounds?: number;
    betMinor: number;
    payoutMinor: number;
    profitMinor: number;
  }[];
};

function MetricCard({
  label,
  cell,
  fallback,
  money,
  t,
}: {
  label: string;
  cell?: MetricCell;
  fallback?: number | null;
  money?: boolean;
  t: (k: string) => string;
}) {
  if (!cell) {
    if (fallback == null) {
      return <StatCard label={label} value={t("common.notAvailable")} tone="warn" />;
    }
    return <StatCard label={label} value={money ? fmtMinor(fallback) : fallback} />;
  }
  if (cell.availability === "ERROR") {
    return (
      <StatCard
        label={label}
        value={t("common.unavailable")}
        tone="bad"
        sub={cell.error ? cell.error.slice(0, 80) : cell.source}
      />
    );
  }
  if (cell.availability === "NOT_AVAILABLE") {
    return (
      <StatCard
        label={label}
        value={t("common.notAvailable")}
        tone="warn"
        sub={cell.source}
      />
    );
  }
  const value = cell.value ?? 0;
  return (
    <StatCard
      label={label}
      value={money ? fmtMinor(value) : value.toLocaleString()}
      sub={cell.source}
    />
  );
}

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
      // Do not clear previous success data; never invent zeros on failure.
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

  if (error && !data) {
    return (
      <div>
        <ErrorBox message={error} />
        <button className="ab-btn" onClick={() => void load()}>
          ⟳ {t("common.retry")}
        </button>
      </div>
    );
  }
  if (!data) return <Loading text={t("common.loading")} />;

  const m = data.metrics;
  const healthTone = (ok: boolean) => (ok ? ("ok" as const) : ("bad" as const));
  const currencies = data.byCurrency ?? [];
  const sparks = data.sparklineSpins ?? data.hourly.map((h) => h.spins);
  const tt = t as (k: string) => string;

  return (
    <div>
      <div className="ab-money-gate-banner" role="status">
        <div><b>{tt("money.realProvider")}:</b> {data.moneyGate?.realMoneyProvider ?? tt("money.notConfigured")}</div>
        <div><b>{tt("money.productionMoney")}:</b> {tt("money.gateClosed")}</div>
      </div>
      {error ? <ErrorBox message={`${tt("common.partialError")}: ${error}`} /> : null}
      <div className="ab-toolbar">
        <button className="ab-btn" onClick={() => void load()}>
          ⟳ {t("common.refresh")}
        </button>
        <label className="ab-chip" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} />
          {t("common.autoRefresh")} (10s)
        </label>
        <span className="ab-chip">
          {t("common.updatedAt")}: <b>{updatedAt || "-"}</b>
          {data.cached ? ` · ${tt("dash.cached")}` : ""}
        </span>
        <span className="ab-chip ab-sparkline-wrap">
          {t("dash.sparkline")}
          {sparks.length ? (
            <svg className="ab-sparkline" viewBox="0 0 160 36" width={160} height={36} aria-hidden>
              <polyline
                fill="none"
                stroke="#60a5fa"
                strokeWidth="2"
                points={sparks
                  .map((v, i) => {
                    const max = Math.max(...sparks, 1);
                    const step = sparks.length > 1 ? 160 / (sparks.length - 1) : 160;
                    return `${(i * step).toFixed(1)},${(36 - (v / max) * 32 - 2).toFixed(1)}`;
                  })
                  .join(" ")}
              />
            </svg>
          ) : (
            <span className="ab-chip">{t("common.empty")}</span>
          )}
        </span>
      </div>

      <div className="ab-grid-stats ab-dash-metrics">
        <MetricCard label={tt("dash.totalPlayers")} cell={m?.totalPlayers} fallback={data.totalPlayers} t={tt} />
        <MetricCard label={tt("dash.todayNew")} cell={m?.todayNew} fallback={data.todayNew} t={tt} />
        <MetricCard label={tt("dash.onlineNow")} cell={m?.onlineNow} fallback={data.onlineNow} t={tt} />
        <MetricCard label={tt("dash.todayLogin")} cell={m?.todayLoginPlayers} t={tt} />
        <MetricCard label={tt("dash.todayActive")} cell={m?.todayActivePlayers} fallback={data.todayActive} t={tt} />
        <MetricCard label={tt("dash.todayGamePlayers")} cell={m?.todayGamePlayers} t={tt} />
        <MetricCard label={tt("dash.todayRounds")} cell={m?.todayRounds} fallback={data.spinCount} t={tt} />
        <MetricCard label={tt("dash.todaySpins")} cell={m?.todaySpins} fallback={data.spinCount} t={tt} />
        <MetricCard label={tt("dash.todayBet")} cell={m?.todayBetMinor} fallback={data.todayBetMinor} money t={tt} />
        <MetricCard label={tt("dash.todayPayout")} cell={m?.todayPayoutMinor} fallback={data.todayPayoutMinor} money t={tt} />
        <MetricCard label={tt("dash.todayProfit")} cell={m?.todayProfitMinor} fallback={data.todayProfitMinor} money t={tt} />
        <StatCard
          label={t("dash.rtp")}
          value={data.rtpPercent == null ? t("common.notAvailable") : `${data.rtpPercent.toFixed(2)}%`}
        />
        <StatCard label={t("dash.freeSpinsNow")} value={data.freeSpinsNow} />
        <StatCard
          label={t("dash.anomalyCount")}
          value={data.anomalyCount}
          warn={data.anomalyCount > 0}
          tone={data.anomalyCount > 0 ? "bad" : "ok"}
        />
        <MetricCard
          label={tt("dash.todayDeposits")}
          cell={data.moneyMetrics?.todayDepositCount}
          fallback={data.todayDepositCount}
          t={tt}
        />
        <MetricCard
          label={tt("dash.todayWithdrawals")}
          cell={data.moneyMetrics?.todayWithdrawCount}
          fallback={data.todayWithdrawCount}
          t={tt}
        />
        <MetricCard
          label={tt("dash.pendingDeposits")}
          cell={data.moneyMetrics?.pendingDepositCount}
          fallback={data.pendingDepositCount}
          t={tt}
        />
        <MetricCard
          label={tt("dash.pendingWithdrawals")}
          cell={data.moneyMetrics?.pendingWithdrawCount}
          fallback={data.pendingWithdrawCount}
          t={tt}
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
        <StatCard
          label={t("dash.apiStatus")}
          value={data.api.ok ? t("dash.healthy") : t("dash.degraded")}
          tone={healthTone(data.api.ok)}
          sub={data.api.probed ? tt("dash.probed") : tt("dash.notProbed")}
        />
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
          {data.hourly.length === 0 ? (
            <div className="ab-chip">{t("common.empty")}</div>
          ) : (
            <LineChart
              series={[
                {
                  name: t("dash.hourlySpins"),
                  points: data.hourly.map((row) => ({ x: row.hour, y: row.spins })),
                },
              ]}
            />
          )}
        </div>
        <div className="ab-panel">
          <div className="ab-panel-title">{tt("dash.trend7dActive")}</div>
          {(data.trend7d ?? []).length === 0 ? (
            <div className="ab-chip">{t("common.empty")}</div>
          ) : (
            <LineChart
              series={[
                {
                  name: tt("dash.todayNew"),
                  points: (data.trend7d ?? []).map((row) => ({ x: row.day, y: row.newPlayers })),
                },
                {
                  name: tt("dash.todayActive"),
                  points: (data.trend7d ?? []).map((row) => ({ x: row.day, y: row.activePlayers })),
                },
                {
                  name: tt("dash.todayGamePlayers"),
                  points: (data.trend7d ?? []).map((row) => ({
                    x: row.day,
                    y: row.gamePlayers ?? row.activePlayers,
                  })),
                },
              ]}
            />
          )}
        </div>
        <div className="ab-panel">
          <div className="ab-panel-title">{tt("dash.trend7dRounds")}</div>
          {(data.trend7d ?? []).length === 0 ? (
            <div className="ab-chip">{t("common.empty")}</div>
          ) : (
            <BarChart
              groups={(data.trend7d ?? []).map((row) => ({
                label: row.day,
                values: [{ name: tt("dash.todayRounds"), value: row.rounds ?? 0 }],
              }))}
            />
          )}
        </div>
        <div className="ab-panel">
          <div className="ab-panel-title">{t("dash.trend7dMoney")}</div>
          {(data.trend7d ?? []).length === 0 ? (
            <div className="ab-chip">{t("common.empty")}</div>
          ) : (
            <BarChart
              groups={(data.trend7d ?? []).map((row) => ({
                label: row.day,
                values: [
                  { name: t("rounds.betAmount"), value: row.betMinor },
                  { name: t("rounds.winAmount"), value: row.payoutMinor, color: "#34d399" },
                ],
              }))}
            />
          )}
        </div>
        <div className="ab-panel">
          <div className="ab-panel-title">{t("dash.intentStatusDist")}</div>
          {data.wallet.byStatus.length === 0 ? (
            <div className="ab-chip">{t("common.empty")}</div>
          ) : (
            <PieChart data={data.wallet.byStatus.map((row) => ({ name: row.status, value: row.count }))} />
          )}
        </div>
        <div className="ab-panel">
          <div className="ab-panel-title">{t("dash.roundStatusDist")}</div>
          {data.roundStatus.length === 0 ? (
            <div className="ab-chip">{t("common.empty")}</div>
          ) : (
            <PieChart data={data.roundStatus.map((row) => ({ name: row.status, value: row.count }))} />
          )}
        </div>
        {currencies.length > 0 ? (
          <div className="ab-panel">
            <div className="ab-panel-title">{t("dash.byCurrency")}</div>
            <BarChart
              groups={currencies.map((row) => ({
                label: row.currency,
                values: [
                  { name: t("rounds.betAmount"), value: row.betMinor },
                  { name: t("rounds.winAmount"), value: row.payoutMinor, color: "#34d399" },
                ],
              }))}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

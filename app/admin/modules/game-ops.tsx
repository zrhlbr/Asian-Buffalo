"use client";

/** ADMIN-1C — 牛魔王运营详情（只读）：Math/RTP 标识、健康、异常局入口。 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DataTable,
  ErrorBox,
  Loading,
  StatCard,
  fmtMinor,
  fmtTime,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type GameOps = {
  game: {
    id: string;
    code: string;
    nameZh: string;
    nameEn: string;
    status: string;
    version?: string | null;
    build?: string | null;
    mathVersionId?: string | null;
    paytableVersion?: string | null;
    rtpIdentifier?: string | number | null;
    mathStatus?: string | null;
    activatedAt?: string | null;
  };
  today: {
    spins: number;
    rounds?: number;
    players: number;
    betMinor: number;
    winMinor: number;
    freeGames: number;
  };
  presence?: {
    openSessions: number;
    onlinePlayers: null;
    onlinePlayersAvailability: string;
    note?: string;
  };
  lastActivityAt?: string | null;
  jackpotEvents: { big: number; mega: number; ultra: number; jackpot: number };
  health?: {
    components?: {
      gameApi?: { ok?: boolean };
      session?: { ok?: boolean; openSessions?: number };
      spinService?: { ok?: boolean; pendingRounds?: number; lastSuccessfulSpinAt?: string | null };
      db?: { ok?: boolean; latencyMs?: number };
      ledger?: { ok?: boolean };
    };
    lastError?: { at: string; type: string } | null;
  };
  anomalies?: {
    total: number;
    items: Array<{
      code: string;
      severity: string;
      roundId: string;
      playerId: string;
      status: string;
      note: string;
      createdAt: string;
    }>;
  };
  readonly?: { math?: boolean; rtp?: boolean; rng?: boolean; paytable?: boolean };
  modelLimitations?: string[];
};

const DEFAULT_GAME_ID = "bull-demon-king";

function okBadge(ok: boolean | undefined, t: (k: string) => string) {
  if (ok == null) return <Badge tone="gray">{t("common.notAvailable")}</Badge>;
  return ok ? <Badge tone="green">OK</Badge> : <Badge tone="red">ERROR</Badge>;
}

export default function GameOpsModule({ initialProps }: { initialProps?: Record<string, string> }) {
  const { t, api, openTab } = useAdmin();
  const tt = t as (k: string) => string;
  const gameId = initialProps?.gameId || DEFAULT_GAME_ID;
  const [data, setData] = useState<GameOps | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<GameOps>(`games/${encodeURIComponent(gameId)}/ops`));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, gameId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Loading text={tt("common.loading")} />;

  const g = data.game;
  const health = data.health?.components;
  const anomalyCols: ColumnDef<(typeof data.anomalies extends { items: infer I } ? I : never) extends Array<infer U> ? U : never>[] = [
    { key: "code", title: tt("common.status"), render: (row) => <Badge tone={row.severity === "CRITICAL" ? "red" : "amber"}>{row.code}</Badge> },
    { key: "roundId", title: tt("rounds.roundId"), render: (row) => <span className="ab-mono">{row.roundId.slice(0, 12)}…</span> },
    { key: "playerId", title: tt("rounds.playerId"), render: (row) => <span className="ab-mono">{row.playerId.slice(0, 10)}…</span> },
    { key: "note", title: tt("math.note"), render: (row) => row.note },
    { key: "createdAt", title: tt("common.time"), render: (row) => fmtTime(row.createdAt) },
    {
      key: "actions",
      title: tt("common.actions"),
      render: (row) => (
        <button
          className="ab-btn"
          onClick={(event) => {
            event.stopPropagation();
            openTab({
              key: `rounds:${row.roundId}`,
              titleKey: "nav.rounds",
              props: { roundId: row.roundId, playerId: row.playerId },
            });
          }}
        >
          {tt("gameOps.openAnomalyRound")}
        </button>
      ),
    },
  ];

  return (
    <div className="ab-module-game-ops">
      <div className="ab-chip" style={{ marginBottom: 12 }}>
        {tt("gameOps.readonlyHint")}
      </div>
      <div className="ab-chip" style={{ marginBottom: 12 }}>
        {tt("gameOps.noEditMath")}
      </div>
      <div className="ab-toolbar">
        <span className="ab-chip">
          {tt("gameOps.game")}: <b>{g.nameZh || g.nameEn}</b>{" "}
          <span className="ab-mono">({g.id})</span>
        </span>
        <button className="ab-btn" onClick={() => void load()}>
          ⟳ {tt("common.refresh")}
        </button>
        <button
          className="ab-btn"
          onClick={() =>
            openTab({
              key: `rounds:game:${g.id}`,
              titleKey: "nav.rounds",
              props: { gameId: g.id },
            })
          }
        >
          {tt("gameOps.openRounds")}
        </button>
        <button
          className="ab-btn"
          onClick={() =>
            openTab({
              key: `spins:game:${g.id}`,
              titleKey: "nav.spins",
              props: { gameId: g.id },
            })
          }
        >
          {tt("gameOps.openSpins")}
        </button>
        {g.mathVersionId ? (
          <button
            className="ab-btn"
            onClick={() =>
              openTab({
                key: `math:${g.mathVersionId}`,
                titleKey: "nav.math",
                props: { mathVersionId: String(g.mathVersionId) },
              })
            }
          >
            {tt("gameOps.openMath")}
          </button>
        ) : null}
      </div>
      {error ? <ErrorBox message={error} /> : null}

      <div className="ab-panel" style={{ marginTop: 12 }}>
        <div className="ab-panel-title">{tt("gameOps.title")}</div>
        <div className="ab-kv" style={{ marginTop: 8 }}>
          <div className="ab-kv-item"><span className="k">{tt("games.id")}</span><span className="v ab-mono">{g.id}</span></div>
          <div className="ab-kv-item"><span className="k">{tt("games.name")}</span><span className="v">{g.nameZh || g.nameEn}</span></div>
          <div className="ab-kv-item"><span className="k">{tt("gameOps.version")}</span><span className="v">{g.version ?? tt("common.notAvailable")}</span></div>
          <div className="ab-kv-item"><span className="k">{tt("gameOps.build")}</span><span className="v">{g.build ?? tt("common.notAvailable")}</span></div>
          <div className="ab-kv-item"><span className="k">{tt("gameOps.status")}</span><span className="v"><Badge tone={g.status === "ACTIVE" ? "green" : g.status === "MAINTENANCE" ? "amber" : "gray"}>{g.status}</Badge></span></div>
          <div className="ab-kv-item"><span className="k">{tt("gameOps.mathVersion")}</span><span className="v ab-mono">{g.mathVersionId ?? tt("common.notAvailable")}</span></div>
          <div className="ab-kv-item"><span className="k">{tt("gameOps.paytableVersion")}</span><span className="v">{g.paytableVersion ?? tt("common.notAvailable")}</span></div>
          <div className="ab-kv-item"><span className="k">{tt("gameOps.rtpRo")}</span><span className="v">{g.rtpIdentifier == null ? tt("common.notAvailable") : String(g.rtpIdentifier)}</span></div>
          <div className="ab-kv-item"><span className="k">{tt("gameOps.lastActivity")}</span><span className="v">{data.lastActivityAt ? fmtTime(data.lastActivityAt) : tt("common.notAvailable")}</span></div>
          <div className="ab-kv-item"><span className="k">{tt("gameOps.onlineNa")}</span><span className="v">{tt("common.notAvailable")}</span></div>
          <div className="ab-kv-item"><span className="k">{tt("gameOps.openSessions")}</span><span className="v">{String(data.presence?.openSessions ?? 0)}</span></div>
        </div>
      </div>

      <div className="ab-grid-stats" style={{ marginTop: 16 }}>
        <StatCard label={tt("gameOps.todayPlayers")} value={data.today.players} />
        <StatCard label={tt("gameOps.todayRounds")} value={data.today.rounds ?? data.today.spins} />
        <StatCard label={tt("gameOps.todaySpins")} value={data.today.spins} />
        <StatCard label={tt("gameOps.todayBet")} value={fmtMinor(data.today.betMinor)} />
        <StatCard label={tt("gameOps.todayWin")} value={fmtMinor(data.today.winMinor)} />
        <StatCard label={tt("gameOps.freeGames")} value={data.today.freeGames} />
      </div>

      <div className="ab-panel" style={{ marginTop: 16 }}>
        <div className="ab-panel-title">{tt("gameOps.health")}</div>
        <div className="ab-kv" style={{ marginTop: 8 }}>
          <div className="ab-kv-item"><span className="k">{tt("gameOps.healthApi")}</span><span className="v">{okBadge(health?.gameApi?.ok, tt)}</span></div>
          <div className="ab-kv-item"><span className="k">{tt("gameOps.healthSession")}</span><span className="v">{okBadge(health?.session?.ok, tt)} · {health?.session?.openSessions ?? 0}</span></div>
          <div className="ab-kv-item"><span className="k">{tt("gameOps.healthSpin")}</span><span className="v">{okBadge(health?.spinService?.ok, tt)} · pending {health?.spinService?.pendingRounds ?? 0}</span></div>
          <div className="ab-kv-item"><span className="k">{tt("gameOps.healthDb")}</span><span className="v">{okBadge(health?.db?.ok, tt)}{health?.db?.latencyMs != null ? ` · ${health.db.latencyMs}ms` : ""}</span></div>
          <div className="ab-kv-item"><span className="k">{tt("gameOps.healthLedger")}</span><span className="v">{okBadge(health?.ledger?.ok, tt)}</span></div>
          <div className="ab-kv-item"><span className="k">{tt("gameOps.lastSpin")}</span><span className="v">{health?.spinService?.lastSuccessfulSpinAt ? fmtTime(health.spinService.lastSuccessfulSpinAt) : tt("common.notAvailable")}</span></div>
          <div className="ab-kv-item"><span className="k">{tt("gameOps.lastError")}</span><span className="v">{data.health?.lastError ? `${data.health.lastError.type} @ ${fmtTime(data.health.lastError.at)}` : tt("common.notAvailable")}</span></div>
        </div>
      </div>

      <div className="ab-panel" style={{ marginTop: 16 }}>
        <div className="ab-panel-title">{tt("gameOps.jackpotEvents")}</div>
        <div className="ab-grid-stats">
          <StatCard label={tt("gameOps.big")} value={data.jackpotEvents.big} />
          <StatCard label={tt("gameOps.mega")} value={data.jackpotEvents.mega} />
          <StatCard label={tt("gameOps.ultra")} value={data.jackpotEvents.ultra} />
          <StatCard label={tt("gameOps.jackpot")} value={data.jackpotEvents.jackpot} />
        </div>
      </div>

      <div className="ab-panel" style={{ marginTop: 16 }}>
        <div className="ab-panel-title">
          {tt("gameOps.anomalies")} · {data.anomalies?.total ?? 0}
        </div>
        <div className="ab-table-scroll">
          <DataTable
            columns={anomalyCols as ColumnDef<Record<string, unknown>>[]}
            rows={(data.anomalies?.items ?? []) as unknown as Record<string, unknown>[]}
            empty={tt("common.empty")}
          />
        </div>
      </div>

      {data.modelLimitations && data.modelLimitations.length > 0 ? (
        <div className="ab-panel" style={{ marginTop: 16 }}>
          <div className="ab-panel-title">{tt("games.modelLimitation")}</div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {data.modelLimitations.map((line) => (
              <li key={line} className="ab-muted" style={{ fontSize: 12 }}>
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

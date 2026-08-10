"use client";

/** Games list — read-only ops snapshot; link into 牛魔王 game ops. */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DataTable,
  ErrorBox,
  Loading,
  fmtMinor,
  fmtTime,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type GameRow = {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  status: string;
  version?: string | null;
  mathVersion?: string | null;
  mathVersionId?: string | null;
  paytableVersion?: string | null;
  rtpIdentifier?: string | number | null;
  build?: string | null;
  onlineSessions: number;
  onlineSessionsAvailability?: string;
  onlinePlayersAvailability?: string;
  todayPlayers?: number;
  todayRounds: number;
  todaySpins?: number;
  todayBetMinor: number;
  todayWinMinor: number;
  todayAvailability?: string;
  lastActivityAt?: string | null;
  [key: string]: unknown;
};

function statusTone(status: string): "green" | "amber" | "gray" | "red" {
  if (status === "ACTIVE") return "green";
  if (status === "MAINTENANCE") return "amber";
  if (status === "DISABLED") return "red";
  return "gray";
}

function statusLabel(
  status: string,
  t: (k: "games.statusActive" | "games.statusMaintenance" | "games.statusDisabled" | "games.statusUnknown") => string,
): string {
  if (status === "ACTIVE") return t("games.statusActive");
  if (status === "MAINTENANCE") return t("games.statusMaintenance");
  if (status === "DISABLED") return t("games.statusDisabled");
  if (status === "UNKNOWN") return t("games.statusUnknown");
  return status;
}

function metricCell(
  availability: string | undefined,
  value: number | null | undefined,
  t: (k: "games.statsError" | "common.notAvailable") => string,
  format: (n: number) => string = String,
): string {
  if (availability === "ERROR") return t("games.statsError");
  if (availability === "NOT_AVAILABLE" || value == null) return t("common.notAvailable");
  return format(value);
}

export default function GamesModule() {
  const { t, api, openTab } = useAdmin();
  const [items, setItems] = useState<GameRow[] | null>(null);
  const [limitations, setLimitations] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api<{ items: GameRow[]; modelLimitations?: string[] }>("games");
      setItems(result.items ?? []);
      setLimitations(result.modelLimitations ?? []);
      setError(null);
    } catch (cause) {
      setItems(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnDef<GameRow>[] = [
    { key: "id", title: t("games.id"), render: (row) => <span className="ab-mono">{row.id}</span> },
    {
      key: "name",
      title: t("games.name"),
      render: (row) => row.nameZh || row.nameEn || row.code,
    },
    {
      key: "status",
      title: t("games.status"),
      render: (row) => (
        <Badge tone={statusTone(row.status)}>{statusLabel(row.status, t)}</Badge>
      ),
    },
    {
      key: "version",
      title: t("games.version"),
      render: (row) => (row.version ? String(row.version) : t("common.notAvailable")),
    },
    {
      key: "mathVersion",
      title: t("games.mathVersion"),
      render: (row) =>
        row.mathVersionId || row.mathVersion
          ? <span className="ab-mono">{String(row.mathVersionId || row.mathVersion).slice(0, 12)}</span>
          : t("common.notAvailable"),
    },
    {
      key: "onlineSessions",
      title: t("games.online"),
      render: (row) =>
        metricCell(row.onlineSessionsAvailability, row.onlineSessions, t),
    },
    {
      key: "todayPlayers",
      title: t("games.todayPlayers"),
      render: (row) => metricCell(row.todayAvailability, row.todayPlayers ?? 0, t),
    },
    {
      key: "todayRounds",
      title: t("games.todayRounds"),
      render: (row) => metricCell(row.todayAvailability, row.todayRounds, t),
    },
    {
      key: "todaySpins",
      title: t("games.todaySpins"),
      render: (row) => metricCell(row.todayAvailability, row.todaySpins ?? row.todayRounds, t),
    },
    {
      key: "todayBetMinor",
      title: t("games.todayBet"),
      render: (row) =>
        metricCell(row.todayAvailability, row.todayBetMinor, t, (n) => fmtMinor(n)),
    },
    {
      key: "todayWinMinor",
      title: t("games.todayWin"),
      render: (row) =>
        metricCell(row.todayAvailability, row.todayWinMinor, t, (n) => fmtMinor(n)),
    },
    {
      key: "lastActivityAt",
      title: t("games.lastActivity"),
      render: (row) => (row.lastActivityAt ? fmtTime(row.lastActivityAt) : t("common.notAvailable")),
    },
    {
      key: "actions",
      title: t("common.actions"),
      render: (row) => (
        <div className="ab-toolbar" style={{ gap: 6, flexWrap: "wrap" }}>
          <button
            className="ab-btn"
            onClick={(event) => {
              event.stopPropagation();
              openTab({
                key: `gameOps:${row.id}`,
                titleKey: "nav.gameOps",
                props: { gameId: row.id },
              });
            }}
          >
            {t("games.openOps")}
          </button>
          <button
            className="ab-btn"
            onClick={(event) => {
              event.stopPropagation();
              openTab({
                key: `rounds:${row.id}`,
                titleKey: "nav.rounds",
                props: { gameId: row.id },
              });
            }}
          >
            {t("games.openRounds")}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="ab-chip" style={{ marginBottom: 12 }}>
        {t("games.readonlyHint")}
      </div>
      <div className="ab-chip" style={{ marginBottom: 12 }}>
        {t("games.onlinePlayersNa")}
      </div>
      {limitations.length > 0 ? (
        <div className="ab-panel" style={{ marginBottom: 12 }}>
          <div className="ab-panel-title">{t("games.modelLimitation")}</div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {limitations.map((line) => (
              <li key={line} className="ab-muted" style={{ fontSize: 12 }}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="ab-toolbar">
        <button className="ab-btn" onClick={() => void load()}>
          ⟳ {t("common.refresh")}
        </button>
      </div>
      {error ? <ErrorBox message={error} /> : null}
      {!items && !error ? (
        <Loading text={t("common.loading")} />
      ) : null}
      {items ? (
        <DataTable
          columns={columns}
          rows={items}
          empty={t("games.emptyHonest")}
          onRowClick={(row) =>
            openTab({
              key: `gameOps:${row.id}`,
              titleKey: "nav.gameOps",
              props: { gameId: row.id },
            })
          }
        />
      ) : null}
    </div>
  );
}

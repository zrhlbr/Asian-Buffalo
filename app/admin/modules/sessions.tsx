"use client";

/** R1-M9 — Session query: list + detail (read-only). */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DataTable,
  ErrorBox,
  Loading,
  Pagination,
  fmtMinor,
  fmtTime,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type SessionRow = {
  id: string;
  player_id: string;
  math_version_id: string;
  status: string;
  currency: string;
  free_games_remaining: number;
  expires_at: string;
  created_at: string;
  round_count: number;
  total_bet: number;
  total_win: number;
  [key: string]: unknown;
};

type SessionDetail = {
  session: Record<string, unknown>;
  player: Record<string, unknown> | null;
  aggregates: { roundCount: number; totalBetMinor: number; totalWinMinor: number };
  rounds: Record<string, unknown>[];
};

function sessionBadge(
  status: string,
  t: (k: "sessions.statusOpen" | "sessions.statusClosed" | "sessions.statusRevoked") => string,
) {
  if (status === "OPEN") return <Badge tone="green">{t("sessions.statusOpen")}</Badge>;
  if (status === "CLOSED") return <Badge tone="gray">{t("sessions.statusClosed")}</Badge>;
  return <Badge tone="red">{t("sessions.statusRevoked")}</Badge>;
}

export default function SessionsModule() {
  const { t, api } = useAdmin();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; pageSize: number; items: SessionRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      setData(await api(`sessions?${params}`));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, page, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnDef<SessionRow>[] = [
    { key: "id", title: t("sessions.id"), render: (row) => <span className="ab-mono">{row.id.slice(0, 10)}…</span> },
    { key: "player_id", title: t("sessions.playerId"), render: (row) => <span className="ab-mono">{row.player_id.slice(0, 10)}…</span> },
    { key: "status", title: t("common.status"), render: (row) => sessionBadge(row.status, t) },
    { key: "round_count", title: t("sessions.roundCount"), render: (row) => String(row.round_count) },
    { key: "total_bet", title: t("sessions.totalBet"), render: (row) => fmtMinor(row.total_bet) },
    { key: "total_win", title: t("sessions.totalWin"), render: (row) => fmtMinor(row.total_win) },
    { key: "free_games_remaining", title: t("sessions.freeGames"), render: (row) => String(row.free_games_remaining) },
    { key: "math_version_id", title: t("sessions.mathVersion"), render: (row) => <span className="ab-mono">{row.math_version_id.slice(0, 8)}</span> },
    { key: "expires_at", title: t("sessions.expiresAt"), render: (row) => fmtTime(row.expires_at) },
    { key: "created_at", title: t("common.createdAt"), render: (row) => fmtTime(row.created_at) },
  ];

  return (
    <div>
      <div className="ab-chip" style={{ marginBottom: 12 }}>{t("common.readonlyHint")}</div>
      <div className="ab-toolbar">
        <input
          className="ab-input"
          placeholder={t("common.search")}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          className="ab-select"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("common.all")}</option>
          <option value="OPEN">{t("sessions.statusOpen")}</option>
          <option value="CLOSED">{t("sessions.statusClosed")}</option>
          <option value="REVOKED">{t("sessions.statusRevoked")}</option>
        </select>
        <button className="ab-btn" onClick={() => void load()}>⟳ {t("common.refresh")}</button>
      </div>

      {error ? <ErrorBox message={error} /> : null}
      {!data ? (
        <Loading text={t("common.loading")} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data.items}
            empty={t("common.empty")}
            onRowClick={(row) =>
              void api<SessionDetail>(`sessions/${encodeURIComponent(row.id)}`).then(setDetail).catch(() => undefined)
            }
          />
          <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}

      {detail ? (
        <div className="ab-modal-mask" onClick={() => setDetail(null)}>
          <div className="ab-modal wide" onClick={(event) => event.stopPropagation()}>
            <div className="ab-modal-title">
              {t("sessions.detail")} <span className="ab-mono">{String(detail.session.id)}</span>
            </div>
            <div className="ab-kv" style={{ marginTop: 12 }}>
              <div className="ab-kv-item"><span className="k">{t("sessions.playerId")}</span><span className="v ab-mono">{String(detail.session.player_id)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("common.status")}</span><span className="v">{sessionBadge(String(detail.session.status), t)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("sessions.mathVersion")}</span><span className="v ab-mono">{String(detail.session.math_version_id)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("sessions.freeGames")}</span><span className="v">{String(detail.session.free_games_remaining)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("sessions.expiresAt")}</span><span className="v">{fmtTime(String(detail.session.expires_at))}</span></div>
              <div className="ab-kv-item"><span className="k">{t("sessions.roundCount")}</span><span className="v">{detail.aggregates.roundCount}</span></div>
              <div className="ab-kv-item"><span className="k">{t("sessions.totalBet")}</span><span className="v">{fmtMinor(detail.aggregates.totalBetMinor)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("sessions.totalWin")}</span><span className="v">{fmtMinor(detail.aggregates.totalWinMinor)}</span></div>
            </div>
            <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("nav.spins")}</div>
            <DataTable
              columns={[
                { key: "id", title: t("spins.id"), render: (row) => <span className="ab-mono">{String(row.id).slice(0, 10)}…</span> },
                { key: "status", title: t("common.status") },
                { key: "total_bet_minor", title: t("rounds.betAmount"), render: (row) => fmtMinor(Number(row.total_bet_minor ?? 0)) },
                { key: "total_win_minor", title: t("rounds.winAmount"), render: (row) => fmtMinor(row.total_win_minor == null ? null : Number(row.total_win_minor)) },
                { key: "created_at", title: t("common.time"), render: (row) => fmtTime(row.created_at == null ? null : String(row.created_at)) },
              ]}
              rows={detail.rounds}
              empty={t("common.empty")}
            />
            <div className="ab-modal-actions">
              <button className="ab-btn" onClick={() => setDetail(null)}>{t("common.close")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

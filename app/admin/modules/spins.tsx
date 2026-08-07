"use client";

/** R1-M9 — Spin query: product-facing alias of game_rounds (read-only). */

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

type SpinRow = {
  id: string;
  session_id: string;
  player_id: string;
  math_version_id: string;
  status: string;
  currency: string;
  total_bet_minor: number;
  total_win_minor: number | null;
  is_free_game: number;
  created_at: string;
  [key: string]: unknown;
};

type SpinDetail = {
  round: Record<string, unknown>;
  session: Record<string, unknown> | null;
  extracted: {
    grid: string[][] | null;
    winningPositions: { reel: number; row: number }[];
    scatterCount: number | null;
    wildCount: number | null;
    multiplier: number | null;
  };
  balanceBefore: number | null;
};

function spinBadge(status: string, t: (k: "rounds.statusPending" | "rounds.statusSettled" | "rounds.statusVoid") => string) {
  if (status === "SETTLED") return <Badge tone="green">{t("rounds.statusSettled")}</Badge>;
  if (status === "PENDING") return <Badge tone="amber">{t("rounds.statusPending")}</Badge>;
  return <Badge tone="gray">{t("rounds.statusVoid")}</Badge>;
}

export default function SpinsModule() {
  const { t, api } = useAdmin();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; pageSize: number; items: SpinRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SpinDetail | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20", sort: "createdAt", order: "desc" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      setData(await api(`spins?${params}`));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, page, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnDef<SpinRow>[] = [
    { key: "id", title: t("spins.id"), render: (row) => <span className="ab-mono">{row.id.slice(0, 10)}…</span> },
    { key: "session_id", title: t("rounds.sessionId"), render: (row) => <span className="ab-mono">{row.session_id.slice(0, 10)}…</span> },
    { key: "player_id", title: t("rounds.playerId"), render: (row) => <span className="ab-mono">{row.player_id.slice(0, 10)}…</span> },
    { key: "status", title: t("rounds.settlement"), render: (row) => spinBadge(row.status, t) },
    { key: "bet", title: t("rounds.betAmount"), render: (row) => fmtMinor(row.total_bet_minor) },
    { key: "win", title: t("rounds.winAmount"), render: (row) => fmtMinor(row.total_win_minor) },
    { key: "is_free_game", title: t("rounds.isFreeGame"), render: (row) => (row.is_free_game ? t("rounds.yes") : t("rounds.no")) },
    { key: "created_at", title: t("common.time"), render: (row) => fmtTime(row.created_at) },
  ];

  return (
    <div>
      <div className="ab-chip" style={{ marginBottom: 12 }}>{t("spins.hint")}</div>
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
          <option value="PENDING">{t("rounds.statusPending")}</option>
          <option value="SETTLED">{t("rounds.statusSettled")}</option>
          <option value="VOID">{t("rounds.statusVoid")}</option>
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
              void api<SpinDetail>(`spins/${encodeURIComponent(row.id)}`).then(setDetail).catch(() => undefined)
            }
          />
          <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
      {detail ? (
        <div className="ab-modal-mask" onClick={() => setDetail(null)}>
          <div className="ab-modal wide" onClick={(event) => event.stopPropagation()}>
            <div className="ab-modal-title">
              {t("spins.detail")} <span className="ab-mono">{String(detail.round.id)}</span>
            </div>
            <div className="ab-kv" style={{ marginTop: 12 }}>
              <div className="ab-kv-item"><span className="k">{t("rounds.sessionId")}</span><span className="v ab-mono">{String(detail.round.session_id)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.playerId")}</span><span className="v ab-mono">{String(detail.round.player_id)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.settlement")}</span><span className="v">{spinBadge(String(detail.round.status), t)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.betAmount")}</span><span className="v">{fmtMinor(Number(detail.round.total_bet_minor))}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.winAmount")}</span><span className="v">{fmtMinor(detail.round.total_win_minor == null ? null : Number(detail.round.total_win_minor))}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.multiplier")}</span><span className="v">{detail.extracted.multiplier ?? "-"}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.balanceBefore")}</span><span className="v">{fmtMinor(detail.balanceBefore)}</span></div>
            </div>
            <div className="ab-modal-actions">
              <button className="ab-btn" onClick={() => setDetail(null)}>{t("common.close")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

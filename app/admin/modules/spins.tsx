"use client";

/** ADMIN-1C — Spin query: product-facing alias of game_rounds (read-only). */

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
  game_id?: string;
  math_version_id: string;
  status: string;
  currency: string;
  total_bet_minor: number;
  total_win_minor: number | null;
  net_minor?: number | null;
  is_free_game: number;
  created_at: string;
  ledger_reference_count?: number;
  [key: string]: unknown;
};

type SpinDetail = {
  round: Record<string, unknown>;
  session: Record<string, unknown> | null;
  ledgerTx?: Record<string, unknown>[];
  walletIntent?: Record<string, unknown>[];
  outcome?: unknown;
  extracted: {
    grid: string[][] | null;
    winningPositions: { reel: number; row: number }[];
    scatterCount: number | null;
    wildCount: number | null;
    multiplier: number | null;
  };
  balanceBefore: number | null;
  balanceBeforeSource?: string;
  netMinor?: number | null;
  gameId?: string;
  ledgerReferences?: string[];
  primaryLedgerReference?: string | null;
  reconciliation?: {
    ok: boolean;
    issues: Array<{ code: string; severity: string; expected: unknown; actual: unknown; note: string }>;
  };
};

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function spinBadge(status: string, t: (k: "rounds.statusPending" | "rounds.statusSettled" | "rounds.statusVoid") => string) {
  if (status === "SETTLED") return <Badge tone="green">{t("rounds.statusSettled")}</Badge>;
  if (status === "PENDING") return <Badge tone="amber">{t("rounds.statusPending")}</Badge>;
  return <Badge tone="gray">{t("rounds.statusVoid")}</Badge>;
}

function GridView({ grid, winning }: { grid: string[][]; winning: { reel: number; row: number }[] }) {
  const winSet = new Set(winning.map((pos) => `${pos.reel}:${pos.row}`));
  return (
    <div className="ab-grid-thumb" style={{ gridTemplateColumns: `repeat(${grid.length}, 26px)` }}>
      {grid.flatMap((reel, reelIndex) =>
        reel.map((symbol, rowIndex) => {
          const cls = winSet.has(`${reelIndex}:${rowIndex}`)
            ? "win"
            : symbol === "scatter"
              ? "scatter"
              : symbol === "wild"
                ? "wild"
                : "";
          return (
            <div key={`${reelIndex}-${rowIndex}`} className={`ab-grid-cell ${cls}`} title={symbol}>
              {symbol.slice(0, 3).toUpperCase()}
            </div>
          );
        }),
      )}
    </div>
  );
}

function resultSummary(row: SpinRow): string {
  const win = row.total_win_minor == null ? "-" : String(row.total_win_minor);
  return `${row.status} · bet ${row.total_bet_minor} · win ${win}`;
}

export default function SpinsModule({ initialProps }: { initialProps?: Record<string, string> }) {
  const { t, api, openTab } = useAdmin();
  const [search, setSearch] = useState(initialProps?.roundId ?? "");
  const [playerId, setPlayerId] = useState(initialProps?.playerId ?? "");
  const [sessionId, setSessionId] = useState(initialProps?.sessionId ?? "");
  const [gameId, setGameId] = useState(initialProps?.gameId ?? "bull-demon-king");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    total: number;
    pageSize: number;
    items: SpinRow[];
    dateRange?: { limited?: boolean };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SpinDetail | null>(null);

  const debouncedSearch = useDebounced(search, 350);
  const debouncedPlayerId = useDebounced(playerId, 350);
  const debouncedSessionId = useDebounced(sessionId, 350);

  useEffect(() => {
    if (initialProps?.playerId) setPlayerId(initialProps.playerId);
    if (initialProps?.sessionId) setSessionId(initialProps.sessionId);
    if (initialProps?.gameId) setGameId(initialProps.gameId);
    if (initialProps?.roundId) {
      setSearch(initialProps.roundId);
      void api<SpinDetail>(`spins/${encodeURIComponent(initialProps.roundId)}`)
        .then(setDetail)
        .catch(() => undefined);
    }
  }, [initialProps?.playerId, initialProps?.sessionId, initialProps?.gameId, initialProps?.roundId, api]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20", sort: "createdAt", order: "desc" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status) params.set("status", status);
      if (debouncedPlayerId) params.set("playerId", debouncedPlayerId);
      if (debouncedSessionId) params.set("sessionId", debouncedSessionId);
      if (gameId) params.set("gameId", gameId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      setData(await api(`spins?${params}`));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, page, debouncedSearch, status, debouncedPlayerId, debouncedSessionId, gameId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnDef<SpinRow>[] = [
    { key: "id", title: t("spins.id"), render: (row) => <span className="ab-mono">{row.id.slice(0, 10)}…</span> },
    {
      key: "round",
      title: t("spins.roundId"),
      render: (row) => <span className="ab-mono">{row.id.slice(0, 10)}…</span>,
    },
    { key: "player_id", title: t("rounds.playerId"), render: (row) => <span className="ab-mono">{row.player_id.slice(0, 10)}…</span> },
    {
      key: "game_id",
      title: t("spins.gameId"),
      render: (row) => <span className="ab-mono">{row.game_id ?? "bull-demon-king"}</span>,
    },
    { key: "bet", title: t("rounds.betAmount"), render: (row) => fmtMinor(row.total_bet_minor) },
    { key: "win", title: t("rounds.winAmount"), render: (row) => fmtMinor(row.total_win_minor) },
    {
      key: "summary",
      title: t("spins.resultSummary"),
      render: (row) => <span className="ab-muted" style={{ fontSize: 12 }}>{resultSummary(row)}</span>,
    },
    { key: "created_at", title: t("common.time"), render: (row) => fmtTime(row.created_at) },
  ];

  return (
    <div>
      <div className="ab-chip" style={{ marginBottom: 12 }}>{t("spins.hint")}</div>
      <div className="ab-toolbar">
        <input
          className="ab-input"
          placeholder={`${t("common.search")} · Spin / Round / Player`}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <input
          className="ab-input"
          placeholder={t("rounds.playerId")}
          value={playerId}
          onChange={(event) => { setPlayerId(event.target.value); setPage(1); }}
        />
        <input
          className="ab-input"
          placeholder={t("rounds.sessionId")}
          value={sessionId}
          onChange={(event) => { setSessionId(event.target.value); setPage(1); }}
        />
        <select
          className="ab-select"
          value={gameId}
          onChange={(event) => {
            setGameId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("common.all")}</option>
          <option value="bull-demon-king">bull-demon-king</option>
        </select>
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
        <input
          className="ab-input"
          type="date"
          title={t("spins.from")}
          value={from}
          onChange={(event) => { setFrom(event.target.value); setPage(1); }}
        />
        <input
          className="ab-input"
          type="date"
          title={t("spins.to")}
          value={to}
          onChange={(event) => { setTo(event.target.value); setPage(1); }}
        />
        <button className="ab-btn" onClick={() => void load()}>⟳ {t("common.refresh")}</button>
      </div>
      {data?.dateRange?.limited ? (
        <div className="ab-chip" style={{ marginBottom: 8 }}>{t("spins.dateLimited")}</div>
      ) : null}
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
              <div className="ab-kv-item"><span className="k">{t("spins.id")}</span><span className="v ab-mono">{String(detail.round.id)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("spins.roundId")}</span><span className="v ab-mono">{String(detail.round.id)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("spins.gameId")}</span><span className="v ab-mono">{detail.gameId ?? "bull-demon-king"}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.playerId")}</span><span className="v ab-mono">{String(detail.round.player_id)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.settlement")}</span><span className="v">{spinBadge(String(detail.round.status), t)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.betAmount")}</span><span className="v">{fmtMinor(Number(detail.round.total_bet_minor))}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.winAmount")}</span><span className="v">{fmtMinor(detail.round.total_win_minor == null ? null : Number(detail.round.total_win_minor))}</span></div>
              <div className="ab-kv-item"><span className="k">{t("spins.net")}</span><span className="v">{fmtMinor(detail.netMinor ?? null)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.balanceBeforeDerived")}</span><span className="v">{fmtMinor(detail.balanceBefore)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.balanceAfter")}</span><span className="v">{fmtMinor(detail.round.balance_after_minor == null ? null : Number(detail.round.balance_after_minor))}</span></div>
              <div className="ab-kv-item"><span className="k">{t("spins.ledgerReference")}</span><span className="v ab-mono">{detail.primaryLedgerReference ?? t("common.notAvailable")}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.multiplier")}</span><span className="v">{detail.extracted.multiplier ?? "-"}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.scatter")} / {t("rounds.wild")}</span><span className="v">{detail.extracted.scatterCount ?? "-"} / {detail.extracted.wildCount ?? "-"}</span></div>
              <div className="ab-kv-item"><span className="k">{t("common.time")}</span><span className="v">{fmtTime(String(detail.round.created_at))}</span></div>
            </div>
            {detail.reconciliation && !detail.reconciliation.ok ? (
              <div className="ab-chip" style={{ marginTop: 12 }}>
                RECONCILIATION ISSUE · {detail.reconciliation.issues.map((i) => i.code).join(", ")}
              </div>
            ) : null}
            {detail.extracted.grid ? (
              <>
                <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("rounds.grid")}</div>
                <GridView grid={detail.extracted.grid} winning={detail.extracted.winningPositions} />
              </>
            ) : null}
            <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("spins.ledgerReference")}</div>
            <DataTable
              columns={[
                { key: "id", title: "TX", render: (row) => <span className="ab-mono">{String(row.id)}</span> },
                { key: "kind", title: t("ledger.kind") },
                { key: "status", title: t("common.status") },
              ]}
              rows={detail.ledgerTx ?? []}
              empty={t("common.empty")}
            />
            {detail.outcome ? (
              <>
                <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("rounds.outcome")}</div>
                <div className="ab-json-view">{JSON.stringify(detail.outcome, null, 2)}</div>
              </>
            ) : null}
            <div className="ab-toolbar" style={{ marginTop: 12 }}>
              <button
                className="ab-btn"
                onClick={() =>
                  openTab({
                    key: `rounds:${String(detail.round.id)}`,
                    titleKey: "nav.rounds",
                    props: { roundId: String(detail.round.id), playerId: String(detail.round.player_id) },
                  })
                }
              >
                {t("spins.openRound")}
              </button>
              <button
                className="ab-btn"
                onClick={() =>
                  openTab({
                    key: `players:${String(detail.round.player_id)}`,
                    titleKey: "nav.players",
                    props: { playerId: String(detail.round.player_id) },
                  })
                }
              >
                {t("spins.openPlayer")}
              </button>
              <button
                className="ab-btn"
                onClick={() => {
                  const txId = detail.primaryLedgerReference
                    ?? (detail.ledgerTx?.[0] ? String(detail.ledgerTx[0].id) : "");
                  openTab({
                    key: `ledger:${String(detail.round.id)}`,
                    titleKey: "nav.ledger",
                    props: {
                      playerId: String(detail.round.player_id),
                      roundId: String(detail.round.id),
                      ...(txId ? { transactionId: txId } : {}),
                    },
                  });
                }}
              >
                {t("spins.openLedger")}
              </button>
              <button
                className="ab-btn"
                onClick={() =>
                  openTab({
                    key: `sessions:${String(detail.round.session_id)}`,
                    titleKey: "nav.sessions",
                    props: { playerId: String(detail.round.player_id) },
                  })
                }
              >
                {t("rounds.openSession")}
              </button>
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

"use client";

/** ADMIN-1C — Rounds list + detail with date/game filters, recon RO, trace links. */

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

type RoundRow = {
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
  balance_after_minor: number | null;
  is_free_game: number;
  free_games_awarded: number;
  wallet_applied: number;
  idempotency_key: string;
  settled_at: string | null;
  created_at: string;
  ledger_reference_count?: number;
  [key: string]: unknown;
};

type RoundDetail = {
  round: Record<string, unknown>;
  session: Record<string, unknown> | null;
  ledgerTx: Record<string, unknown>[];
  walletIntent: Record<string, unknown>[];
  outcome: unknown;
  extracted: {
    grid: string[][] | null;
    winningPositions: { reel: number; row: number }[];
    scatterCount: number | null;
    wildCount: number | null;
    multiplier: number | null;
    mathVersion: string | null;
  };
  balanceBefore: number | null;
  balanceBeforeSource?: string;
  netMinor?: number | null;
  gameId?: string;
  spinCount?: number;
  ledgerReferences?: string[];
  primaryLedgerReference?: string | null;
  reconciliation?: {
    ok: boolean;
    issues: Array<{
      code: string;
      severity: string;
      expected: string | number | null;
      actual: string | number | null;
      note: string;
    }>;
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

function roundStatusBadge(status: string, t: (k: "rounds.statusPending" | "rounds.statusSettled" | "rounds.statusVoid") => string) {
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

function maskSession(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export default function RoundsModule({ initialProps }: { initialProps?: Record<string, string> }) {
  const { t, api, openTab } = useAdmin();
  const [search, setSearch] = useState(initialProps?.roundId ?? "");
  const [playerId, setPlayerId] = useState(initialProps?.playerId ?? "");
  const [sessionId, setSessionId] = useState(initialProps?.sessionId ?? "");
  const [gameId, setGameId] = useState(initialProps?.gameId ?? "bull-demon-king");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [data, setData] = useState<{
    total: number;
    pageSize: number;
    items: RoundRow[];
    dateRange?: { limited?: boolean; error?: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RoundDetail | null>(null);

  const debouncedSearch = useDebounced(search, 350);
  const debouncedPlayerId = useDebounced(playerId, 350);
  const debouncedSessionId = useDebounced(sessionId, 350);

  useEffect(() => {
    if (initialProps?.playerId) setPlayerId(initialProps.playerId);
    if (initialProps?.sessionId) setSessionId(initialProps.sessionId);
    if (initialProps?.gameId) setGameId(initialProps.gameId);
    if (initialProps?.roundId) {
      setSearch(initialProps.roundId);
      void api<RoundDetail>(`rounds/${encodeURIComponent(initialProps.roundId)}`)
        .then(setDetail)
        .catch(() => undefined);
    }
  }, [initialProps?.playerId, initialProps?.sessionId, initialProps?.gameId, initialProps?.roundId, api]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20", sort, order });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status) params.set("status", status);
      if (debouncedPlayerId) params.set("playerId", debouncedPlayerId);
      if (debouncedSessionId) params.set("sessionId", debouncedSessionId);
      if (gameId) params.set("gameId", gameId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      setData(await api(`rounds?${params}`));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, page, debouncedSearch, status, sort, order, debouncedPlayerId, debouncedSessionId, gameId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnDef<RoundRow>[] = [
    { key: "id", title: t("rounds.roundId"), render: (row) => <span className="ab-mono">{row.id.slice(0, 10)}…</span> },
    {
      key: "game_id",
      title: t("rounds.gameId"),
      render: (row) => <span className="ab-mono">{row.game_id ?? "bull-demon-king"}</span>,
    },
    { key: "player_id", title: t("rounds.playerId"), render: (row) => <span className="ab-mono">{row.player_id.slice(0, 10)}…</span> },
    { key: "bet", title: t("rounds.betAmount"), sortable: true, render: (row) => fmtMinor(row.total_bet_minor) },
    { key: "win", title: t("rounds.winAmount"), sortable: true, render: (row) => fmtMinor(row.total_win_minor) },
    {
      key: "net",
      title: t("rounds.net"),
      render: (row) =>
        fmtMinor(
          row.net_minor ??
            (row.total_win_minor == null ? null : Number(row.total_win_minor) - Number(row.total_bet_minor)),
        ),
    },
    { key: "status", title: t("rounds.settlement"), render: (row) => roundStatusBadge(row.status, t) },
    { key: "createdAt", title: t("rounds.startTime"), sortable: true, render: (row) => fmtTime(row.created_at) },
    { key: "settledAt", title: t("rounds.endTime"), render: (row) => fmtTime(row.settled_at) },
  ];

  return (
    <div>
      <div className="ab-chip" style={{ marginBottom: 12 }}>{t("rounds.spinAliasNote")}</div>
      <div className="ab-toolbar">
        <input
          className="ab-input"
          placeholder={`${t("common.search")} · Round / Session / Player`}
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
          title={t("rounds.from")}
          value={from}
          onChange={(event) => { setFrom(event.target.value); setPage(1); }}
        />
        <input
          className="ab-input"
          type="date"
          title={t("rounds.to")}
          value={to}
          onChange={(event) => { setTo(event.target.value); setPage(1); }}
        />
        <button className="ab-btn" onClick={() => void load()}>⟳ {t("common.refresh")}</button>
      </div>
      {data?.dateRange?.limited ? (
        <div className="ab-chip" style={{ marginBottom: 8 }}>{t("rounds.dateLimited")}</div>
      ) : null}

      {error ? <ErrorBox message={error} /> : null}
      {!data ? (
        <Loading text={t("common.loading")} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data.items}
            sort={sort}
            order={order}
            empty={t("common.empty")}
            onSort={(key) => {
              setOrder(sort === key && order === "desc" ? "asc" : "desc");
              setSort(key);
            }}
            onRowClick={(row) =>
              void api<RoundDetail>(`rounds/${encodeURIComponent(row.id)}`).then(setDetail).catch(() => undefined)
            }
          />
          <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}

      {detail ? (
        <div className="ab-modal-mask" onClick={() => setDetail(null)}>
          <div className="ab-modal wide" onClick={(event) => event.stopPropagation()}>
            <div className="ab-modal-title">{t("rounds.roundId")} <span className="ab-mono">{String(detail.round.id)}</span></div>
            <div className="ab-kv" style={{ marginTop: 12 }}>
              <div className="ab-kv-item"><span className="k">{t("rounds.gameId")}</span><span className="v ab-mono">{detail.gameId ?? "bull-demon-king"}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.sessionId")}</span><span className="v ab-mono" title={String(detail.round.session_id)}>{maskSession(String(detail.round.session_id))}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.playerId")}</span><span className="v ab-mono">{String(detail.round.player_id)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.settlement")}</span><span className="v">{roundStatusBadge(String(detail.round.status), t)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.mathVersion")}</span><span className="v ab-mono">{String(detail.round.math_version_id)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.betAmount")}</span><span className="v">{fmtMinor(Number(detail.round.total_bet_minor))}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.winAmount")}</span><span className="v">{fmtMinor(detail.round.total_win_minor == null ? null : Number(detail.round.total_win_minor))}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.net")}</span><span className="v">{fmtMinor(detail.netMinor ?? null)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.balanceBeforeDerived")}</span><span className="v">{fmtMinor(detail.balanceBefore)} {detail.balanceBeforeSource === "NOT_AVAILABLE" ? `(${t("rounds.notAvailable")})` : ""}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.balanceAfter")}</span><span className="v">{fmtMinor(detail.round.balance_after_minor == null ? null : Number(detail.round.balance_after_minor))}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.spinCount")}</span><span className="v">{detail.spinCount ?? 1} <span className="ab-muted">({t("rounds.spinAliasNote")})</span></span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.ledgerReference")}</span><span className="v ab-mono">{detail.primaryLedgerReference ?? t("rounds.notAvailable")}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.startTime")}</span><span className="v">{fmtTime(String(detail.round.created_at))}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.endTime")}</span><span className="v">{fmtTime(detail.round.settled_at == null ? null : String(detail.round.settled_at))}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.freeSpin")}</span><span className="v">{Number(detail.round.is_free_game) ? t("rounds.yes") : t("rounds.no")} (+{Number(detail.round.free_games_awarded ?? 0)})</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.walletApplied")}</span><span className="v">{Number(detail.round.wallet_applied) ? t("rounds.yes") : t("rounds.no")}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.multiplier")}</span><span className="v">{detail.extracted.multiplier ?? "-"}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.scatter")} / {t("rounds.wild")}</span><span className="v">{detail.extracted.scatterCount ?? "-"} / {detail.extracted.wildCount ?? "-"}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.idempotencyKey")}</span><span className="v ab-mono">{String(detail.round.idempotency_key)}</span></div>
            </div>

            {detail.reconciliation ? (
              <div className="ab-panel" style={{ marginTop: 16 }}>
                <div className="ab-panel-title">
                  {t("rounds.reconciliation")} ·{" "}
                  <Badge tone={detail.reconciliation.ok ? "green" : "red"}>
                    {detail.reconciliation.ok ? t("rounds.reconciliationOk") : t("rounds.reconciliationIssues")}
                  </Badge>
                </div>
                {(detail.reconciliation.issues.length > 0) ? (
                  <DataTable
                    columns={[
                      { key: "code", title: "Code", render: (row) => <Badge tone={row.severity === "CRITICAL" ? "red" : "amber"}>{row.code}</Badge> },
                      { key: "expected", title: "Expected", render: (row) => String(row.expected) },
                      { key: "actual", title: "Actual", render: (row) => String(row.actual) },
                      { key: "note", title: t("common.detail") },
                    ]}
                    rows={detail.reconciliation.issues}
                    empty={t("common.empty")}
                  />
                ) : null}
              </div>
            ) : null}

            {detail.extracted.grid ? (
              <>
                <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("rounds.grid")} · {t("rounds.winningPositions")}</div>
                <GridView grid={detail.extracted.grid} winning={detail.extracted.winningPositions} />
              </>
            ) : null}

            <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("rounds.ledgerReference")}</div>
            <DataTable
              columns={[
                { key: "id", title: "TX", render: (row) => <span className="ab-mono">{String(row.id)}</span> },
                { key: "kind", title: t("ledger.kind") },
                { key: "status", title: t("common.status"), render: (row) => <Badge tone={row.status === "POSTED" ? "green" : "amber"}>{String(row.status)}</Badge> },
                { key: "posted_at", title: t("ledger.postedAt"), render: (row) => fmtTime(row.posted_at == null ? null : String(row.posted_at)) },
              ]}
              rows={detail.ledgerTx}
              empty={t("common.empty")}
            />

            <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("rounds.outcome")} JSON</div>
            <div className="ab-json-view">{detail.outcome ? JSON.stringify(detail.outcome, null, 2) : "-"}</div>

            <div className="ab-toolbar" style={{ marginTop: 12 }}>
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
                {t("rounds.openPlayer")}
              </button>
              <button
                className="ab-btn"
                onClick={() =>
                  openTab({
                    key: `spins:${String(detail.round.id)}`,
                    titleKey: "nav.spins",
                    props: { roundId: String(detail.round.id), playerId: String(detail.round.player_id) },
                  })
                }
              >
                {t("rounds.openSpin")}
              </button>
              <button
                className="ab-btn"
                onClick={() =>
                  openTab({
                    key: `sessions:${String(detail.round.session_id)}`,
                    titleKey: "nav.sessions",
                    props: {
                      playerId: String(detail.round.player_id),
                      sessionId: String(detail.round.session_id),
                    },
                  })
                }
              >
                {t("rounds.openSession")}
              </button>
              <button
                className="ab-btn"
                onClick={() => {
                  const intentId = detail.walletIntent[0]
                    ? String(detail.walletIntent[0].id)
                    : "";
                  openTab({
                    key: `wallet:${String(detail.round.player_id)}`,
                    titleKey: "nav.wallet",
                    props: {
                      playerId: String(detail.round.player_id),
                      ...(intentId ? { intentId } : {}),
                    },
                  });
                }}
              >
                {t("rounds.openWallet")}
              </button>
              <button
                className="ab-btn"
                onClick={() => {
                  const txId = detail.primaryLedgerReference
                    ?? (detail.ledgerTx[0] ? String(detail.ledgerTx[0].id) : "");
                  openTab({
                    key: `ledger:${String(detail.round.id)}`,
                    titleKey: "nav.ledger",
                    props: {
                      playerId: String(detail.round.player_id),
                      ...(txId ? { transactionId: txId } : {}),
                      roundId: String(detail.round.id),
                    },
                  });
                }}
              >
                {t("rounds.openLedger")}
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

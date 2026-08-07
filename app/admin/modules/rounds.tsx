"use client";

/** R1-M7 — Game records: rounds list + full round detail with grid render. */

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
  math_version_id: string;
  status: string;
  currency: string;
  total_bet_minor: number;
  total_win_minor: number | null;
  balance_after_minor: number | null;
  is_free_game: number;
  free_games_awarded: number;
  wallet_applied: number;
  idempotency_key: string;
  settled_at: string | null;
  created_at: string;
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
};

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

export default function RoundsModule() {
  const { t, api } = useAdmin();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [data, setData] = useState<{ total: number; pageSize: number; items: RoundRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RoundDetail | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20", sort, order });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      setData(await api(`rounds?${params}`));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, page, search, status, sort, order]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnDef<RoundRow>[] = [
    { key: "id", title: t("rounds.roundId"), render: (row) => <span className="ab-mono">{row.id.slice(0, 10)}…</span> },
    { key: "player_id", title: t("rounds.playerId"), render: (row) => <span className="ab-mono">{row.player_id.slice(0, 10)}…</span> },
    { key: "status", title: t("rounds.settlement"), render: (row) => roundStatusBadge(row.status, t) },
    { key: "bet", title: t("rounds.betAmount"), sortable: true, render: (row) => fmtMinor(row.total_bet_minor) },
    { key: "win", title: t("rounds.winAmount"), sortable: true, render: (row) => fmtMinor(row.total_win_minor) },
    { key: "balance_after_minor", title: t("rounds.balanceAfter"), render: (row) => fmtMinor(row.balance_after_minor) },
    { key: "is_free_game", title: t("rounds.isFreeGame"), render: (row) => (row.is_free_game ? t("rounds.yes") : t("rounds.no")) },
    { key: "math_version_id", title: t("rounds.mathVersion"), render: (row) => <span className="ab-mono">{row.math_version_id.slice(0, 8)}</span> },
    { key: "createdAt", title: t("common.time"), sortable: true, render: (row) => fmtTime(row.created_at) },
  ];

  return (
    <div>
      <div className="ab-toolbar">
        <input
          className="ab-input"
          placeholder={`${t("common.search")} · Round / Session / Player / ${t("rounds.idempotencyKey")}`}
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
              <div className="ab-kv-item"><span className="k">{t("rounds.sessionId")}</span><span className="v ab-mono">{String(detail.round.session_id)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.playerId")}</span><span className="v ab-mono">{String(detail.round.player_id)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.settlement")}</span><span className="v">{roundStatusBadge(String(detail.round.status), t)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.mathVersion")}</span><span className="v ab-mono">{String(detail.round.math_version_id)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.betAmount")}</span><span className="v">{fmtMinor(Number(detail.round.total_bet_minor))}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.winAmount")}</span><span className="v">{fmtMinor(detail.round.total_win_minor == null ? null : Number(detail.round.total_win_minor))}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.balanceBefore")}</span><span className="v">{fmtMinor(detail.balanceBefore)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.balanceAfter")}</span><span className="v">{fmtMinor(detail.round.balance_after_minor == null ? null : Number(detail.round.balance_after_minor))}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.freeSpin")}</span><span className="v">{Number(detail.round.is_free_game) ? t("rounds.yes") : t("rounds.no")} (+{Number(detail.round.free_games_awarded ?? 0)})</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.walletApplied")}</span><span className="v">{Number(detail.round.wallet_applied) ? t("rounds.yes") : t("rounds.no")}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.multiplier")}</span><span className="v">{detail.extracted.multiplier ?? "-"}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.scatter")} / {t("rounds.wild")}</span><span className="v">{detail.extracted.scatterCount ?? "-"} / {detail.extracted.wildCount ?? "-"}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.providerStatus")}</span><span className="v">{detail.walletIntent[0] ? String(detail.walletIntent[0].provider_status ?? detail.walletIntent[0].status) : "-"}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.recovery")}</span><span className="v">{detail.walletIntent.some((intent) => String(intent.status) === "RECOVERED") ? t("rounds.yes") : t("rounds.no")}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.idempotencyKey")}</span><span className="v ab-mono">{String(detail.round.idempotency_key)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("rounds.settledAt")}</span><span className="v">{fmtTime(detail.round.settled_at == null ? null : String(detail.round.settled_at))}</span></div>
            </div>

            {detail.extracted.grid ? (
              <>
                <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("rounds.grid")} · {t("rounds.winningPositions")}</div>
                <GridView grid={detail.extracted.grid} winning={detail.extracted.winningPositions} />
              </>
            ) : null}

            <div className="ab-panel-title" style={{ marginTop: 16 }}>Ledger</div>
            <DataTable
              columns={[
                { key: "id", title: "TX", render: (row) => <span className="ab-mono">{String(row.id).slice(0, 10)}…</span> },
                { key: "kind", title: t("ledger.kind") },
                { key: "status", title: t("common.status"), render: (row) => <Badge tone={row.status === "POSTED" ? "green" : "amber"}>{String(row.status)}</Badge> },
                { key: "posted_at", title: t("ledger.postedAt"), render: (row) => fmtTime(row.posted_at == null ? null : String(row.posted_at)) },
              ]}
              rows={detail.ledgerTx}
              empty={t("common.empty")}
            />

            <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("rounds.outcome")} JSON</div>
            <div className="ab-json-view">{detail.outcome ? JSON.stringify(detail.outcome, null, 2) : "-"}</div>

            <div className="ab-modal-actions">
              <button className="ab-btn" onClick={() => setDetail(null)}>{t("common.close")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

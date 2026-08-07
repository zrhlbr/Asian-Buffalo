"use client";

/** R1-M7 — Players: list (search/sort/pagination/filter) + detail + freeze/unfreeze. */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge,
  DangerConfirm,
  DataTable,
  ErrorBox,
  Loading,
  Pagination,
  fmtMinor,
  fmtTime,
  useAdmin,
  type ColumnDef,
} from "../admin-ui.tsx";

type PlayerRow = {
  id: string;
  walletAdapterRef: string;
  currency: string;
  status: string;
  createdAt: string;
  roundCount: number;
  totalBetMinor: number;
  totalWinMinor: number;
  freeSpins: number;
  openSessions: number;
  lastActiveAt: string | null;
  nickname: string | null;
  vipLevel: number | null;
  device: string | null;
  ip: string | null;
  [key: string]: unknown;
};

type PlayerDetail = {
  player: PlayerRow & { walletAdapterRef: string; updatedAt: string; lastLoginAt: string | null; avatar: string | null };
  aggregates: { roundCount: number; totalBetMinor: number; totalWinMinor: number };
  sessions: Record<string, unknown>[];
  recentRounds: Record<string, unknown>[];
  recentWallet: Record<string, unknown>[];
  ledgerAccounts: Record<string, unknown>[];
};

function statusBadge(status: string, t: (k: never) => string) {
  const tt = t as (k: string) => string;
  if (status === "ACTIVE") return <Badge tone="green">{tt("players.statusActive")}</Badge>;
  if (status === "LOCKED") return <Badge tone="red">{tt("players.statusLocked")}</Badge>;
  return <Badge tone="gray">{tt("players.statusClosed")}</Badge>;
}

export default function PlayersModule() {
  const { t, api, toast } = useAdmin();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [data, setData] = useState<{ total: number; pageSize: number; items: PlayerRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [confirm, setConfirm] = useState<{ playerId: string; freeze: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20", sort, order });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const result = await api<{ total: number; pageSize: number; items: PlayerRow[] }>(`players?${params}`);
      setData(result);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api, page, search, status, sort, order]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (playerId: string) => {
    try {
      setDetail(await api<PlayerDetail>(`players/${encodeURIComponent(playerId)}`));
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    }
  };

  const doFreeze = async (reason: string) => {
    if (!confirm) return;
    setBusy(true);
    try {
      await api(`players/${encodeURIComponent(confirm.playerId)}/${confirm.freeze ? "freeze" : "unfreeze"}`, {
        method: "POST",
        body: { reason },
      });
      toast(t("common.success"));
      setConfirm(null);
      setDetail(null);
      void load();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<PlayerRow>[] = [
    { key: "id", title: t("players.uid"), render: (row) => <span className="ab-mono">{row.id.slice(0, 12)}…</span> },
    { key: "nickname", title: t("players.nickname"), render: () => <span style={{ color: "#4c6aa0" }}>{t("players.noDeviceData")}</span> },
    { key: "vip", title: t("players.vip"), render: () => "-" },
    { key: "status", title: t("common.status"), render: (row) => statusBadge(row.status, t as never) },
    { key: "currency", title: t("common.currency") },
    { key: "totalBet", title: t("players.totalBet"), sortable: true, render: (row) => fmtMinor(row.totalBetMinor) },
    { key: "totalWin", title: t("players.totalWin"), render: (row) => fmtMinor(row.totalWinMinor) },
    { key: "roundCount", title: t("players.roundCount"), sortable: true },
    { key: "freeSpins", title: t("players.freeSpins"), render: (row) => String(row.freeSpins) },
    { key: "lastActiveAt", title: t("players.lastLogin"), render: (row) => fmtTime(row.lastActiveAt) },
    {
      key: "actions",
      title: t("common.actions"),
      render: (row) => (
        <span onClick={(event) => event.stopPropagation()}>
          {row.status === "ACTIVE" ? (
            <button className="ab-btn danger" onClick={() => setConfirm({ playerId: row.id, freeze: true })}>
              {t("players.freeze")}
            </button>
          ) : row.status === "LOCKED" ? (
            <button className="ab-btn success" onClick={() => setConfirm({ playerId: row.id, freeze: false })}>
              {t("players.unfreeze")}
            </button>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="ab-readonly-banner">🔒 {t("players.balanceEditForbidden")}</div>
      <div className="ab-toolbar">
        <input
          className="ab-input"
          placeholder={t("players.searchPlaceholder")}
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
          <option value="ACTIVE">{t("players.statusActive")}</option>
          <option value="LOCKED">{t("players.statusLocked")}</option>
          <option value="CLOSED">{t("players.statusClosed")}</option>
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
            onRowClick={(row) => void openDetail(row.id)}
          />
          <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}

      {detail ? (
        <div className="ab-modal-mask" onClick={() => setDetail(null)}>
          <div className="ab-modal wide" onClick={(event) => event.stopPropagation()}>
            <div className="ab-modal-title">{t("players.detail")}</div>
            <div className="ab-kv" style={{ marginTop: 12 }}>
              <div className="ab-kv-item"><span className="k">{t("players.uid")}</span><span className="v ab-mono">{detail.player.id}</span></div>
              <div className="ab-kv-item"><span className="k">{t("players.walletRef")}</span><span className="v ab-mono">{detail.player.walletAdapterRef}</span></div>
              <div className="ab-kv-item"><span className="k">{t("common.status")}</span><span className="v">{statusBadge(detail.player.status, t as never)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("common.currency")}</span><span className="v">{detail.player.currency}</span></div>
              <div className="ab-kv-item"><span className="k">{t("players.nickname")} / {t("players.avatar")} / {t("players.vip")}</span><span className="v">{t("players.noDeviceData")}</span></div>
              <div className="ab-kv-item"><span className="k">{t("players.device")} / {t("common.ip")}</span><span className="v">{t("players.noDeviceData")}</span></div>
              <div className="ab-kv-item"><span className="k">{t("players.totalBet")}</span><span className="v">{fmtMinor(detail.aggregates.totalBetMinor)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("players.totalWin")}</span><span className="v">{fmtMinor(detail.aggregates.totalWinMinor)}</span></div>
              <div className="ab-kv-item"><span className="k">{t("players.roundCount")}</span><span className="v">{detail.aggregates.roundCount}</span></div>
              <div className="ab-kv-item"><span className="k">{t("common.createdAt")}</span><span className="v">{fmtTime(detail.player.createdAt)}</span></div>
            </div>

            <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("common.balance")} (Ledger)</div>
            <div className="ab-kv">
              {detail.ledgerAccounts.length === 0 ? (
                <div className="ab-kv-item"><span className="v">{t("common.empty")}</span></div>
              ) : (
                detail.ledgerAccounts.map((account) => (
                  <div className="ab-kv-item" key={String(account.id)}>
                    <span className="k">{String(account.kind)}</span>
                    <span className="v">{fmtMinor(Number(account.balance_minor))} {String(account.currency)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("players.session")}</div>
            <DataTable
              columns={[
                { key: "id", title: "Session", render: (row) => <span className="ab-mono">{String(row.id).slice(0, 10)}…</span> },
                { key: "status", title: t("common.status"), render: (row) => <Badge tone={row.status === "OPEN" ? "green" : "gray"}>{String(row.status)}</Badge> },
                { key: "free_games_remaining", title: t("players.freeSpins") },
                { key: "expires_at", title: t("common.time"), render: (row) => fmtTime(String(row.expires_at)) },
              ]}
              rows={detail.sessions}
              empty={t("common.empty")}
            />

            <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("players.recentRounds")}</div>
            <DataTable
              columns={[
                { key: "id", title: "Round", render: (row) => <span className="ab-mono">{String(row.id).slice(0, 10)}…</span> },
                { key: "status", title: t("common.status"), render: (row) => <Badge tone={row.status === "SETTLED" ? "green" : row.status === "PENDING" ? "amber" : "gray"}>{String(row.status)}</Badge> },
                { key: "total_bet_minor", title: t("rounds.betAmount"), render: (row) => fmtMinor(Number(row.total_bet_minor)) },
                { key: "total_win_minor", title: t("rounds.winAmount"), render: (row) => fmtMinor(row.total_win_minor == null ? null : Number(row.total_win_minor)) },
                { key: "created_at", title: t("common.time"), render: (row) => fmtTime(String(row.created_at)) },
              ]}
              rows={detail.recentRounds}
              empty={t("common.empty")}
            />

            <div className="ab-panel-title" style={{ marginTop: 16 }}>{t("players.recentWallet")}</div>
            <DataTable
              columns={[
                { key: "id", title: "Intent", render: (row) => <span className="ab-mono">{String(row.id).slice(0, 10)}…</span> },
                { key: "operation", title: t("wallet.operation") },
                { key: "status", title: t("common.status"), render: (row) => <Badge tone={row.status === "SUCCESS" ? "green" : row.status === "FAILED" || row.status === "UNKNOWN" ? "red" : "blue"}>{String(row.status)}</Badge> },
                { key: "amount_minor", title: t("common.amount"), render: (row) => fmtMinor(Number(row.amount_minor)) },
                { key: "created_at", title: t("common.time"), render: (row) => fmtTime(String(row.created_at)) },
              ]}
              rows={detail.recentWallet}
              empty={t("common.empty")}
            />

            <div className="ab-modal-actions">
              {detail.player.status === "ACTIVE" ? (
                <button className="ab-btn danger" onClick={() => setConfirm({ playerId: detail.player.id, freeze: true })}>
                  {t("players.freeze")}
                </button>
              ) : detail.player.status === "LOCKED" ? (
                <button className="ab-btn success" onClick={() => setConfirm({ playerId: detail.player.id, freeze: false })}>
                  {t("players.unfreeze")}
                </button>
              ) : null}
              <button className="ab-btn" onClick={() => setDetail(null)}>{t("common.close")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {confirm ? (
        <DangerConfirm
          title={t("common.dangerConfirm")}
          description={confirm.freeze ? t("players.freezeConfirm") : t("players.unfreezeConfirm")}
          reasonLabel={t("common.reason")}
          reasonRequired={t("common.reasonRequired")}
          hint={t("common.dangerConfirmHint")}
          confirmLabel={t("common.confirm")}
          cancelLabel={t("common.cancel")}
          busy={busy}
          onConfirm={(reason) => void doFreeze(reason)}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}

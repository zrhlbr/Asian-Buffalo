"use client";

/** ADMIN-1B — Players list + detail tabs + PII/IP masking + freeze/ban UX. */

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  statusLabel?: string;
  createdAt: string;
  roundCount: number;
  totalBetMinor: number;
  totalWinMinor: number;
  freeSpins: number;
  openSessions: number;
  online?: boolean;
  lastActiveAt: string | null;
  nickname: string | null;
  vipLevel: number | null;
  vipStatus: string | null;
  phoneMasked: string | null;
  emailMasked?: string | null;
  lastLoginAt: string | null;
  device: string | null;
  ip: string | null;
  riskTagged?: boolean;
  [key: string]: unknown;
};

type PlayerDetail = {
  player: PlayerRow & {
    walletAdapterRef: string;
    updatedAt: string;
    emailMasked?: string | null;
    online?: boolean;
  };
  aggregates: { roundCount: number; totalBetMinor: number; totalWinMinor: number };
  walletSummary?: {
    availableMinor: number;
    frozenMinor: number;
    totalMinor: number;
    currency: string;
    status?: string;
    note?: string;
    source?: Record<string, string>;
  };
  riskTags?: string[];
  sessions: Record<string, unknown>[];
  devices?: Record<string, unknown>[];
  loginHistory?: Record<string, unknown>[];
  recentRounds: Record<string, unknown>[];
  recentWallet: Record<string, unknown>[];
  ledgerAccounts: Record<string, unknown>[];
  modelLimitation?: string;
  piiMode?: { viewPii: boolean; viewDevices: boolean; viewSessions: boolean };
};

type ConfirmAction =
  | { kind: "freeze"; playerId: string; freeze: boolean; from: string; to: string }
  | { kind: "close"; playerId: string; close: boolean; from: string; to: string }
  | { kind: "revoke"; sessionId: string; playerId: string };

type DetailTab = "overview" | "sessions" | "devices" | "login" | "game" | "wallet";

function statusBadge(status: string, t: (k: string) => string) {
  if (status === "ACTIVE") return <Badge tone="green">{t("players.statusNormal")}</Badge>;
  if (status === "LOCKED") return <Badge tone="red">{t("players.statusFrozen")}</Badge>;
  if (status === "CLOSED") return <Badge tone="amber">{t("players.statusBanned")}</Badge>;
  return <Badge tone="gray">{status}</Badge>;
}

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export default function PlayersModule({ initialProps }: { initialProps?: Record<string, string> }) {
  const { t, api, toast, can, openTab } = useAdmin();
  const tt = t as (k: string) => string;
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 350);
  const [status, setStatus] = useState("");
  const [online, setOnline] = useState("");
  const [vipMin, setVipMin] = useState("");
  const [registeredFrom, setRegisteredFrom] = useState("");
  const [registeredTo, setRegisteredTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [data, setData] = useState<{
    total: number;
    pageSize: number;
    items: PlayerRow[];
    modelLimitation?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listState, setListState] = useState<"loading" | "success" | "error" | "empty">("loading");
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [busy, setBusy] = useState(false);
  const canFreeze = can("players:freeze");
  const canRevoke = can("players:session:revoke");

  const load = useCallback(async () => {
    setListState((prev) => (prev === "success" ? "success" : "loading"));
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort,
        order,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status) params.set("status", status);
      if (online) params.set("online", online);
      if (vipMin) params.set("vipMin", vipMin);
      if (registeredFrom) params.set("registeredFrom", registeredFrom);
      if (registeredTo) params.set("registeredTo", registeredTo);
      const result = await api<{
        total: number;
        pageSize: number;
        items: PlayerRow[];
        modelLimitation?: string;
      }>(`players?${params}`);
      setData(result);
      setError(null);
      setListState(result.items.length === 0 ? "empty" : "success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setListState("error");
    }
  }, [api, page, pageSize, debouncedSearch, status, online, vipMin, registeredFrom, registeredTo, sort, order]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = useCallback(
    async (playerId: string) => {
      try {
        const result = await api<PlayerDetail>(`players/${encodeURIComponent(playerId)}`);
        setDetail(result);
        setDetailTab("overview");
      } catch (cause) {
        toast(cause instanceof Error ? cause.message : String(cause), true);
      }
    },
    [api, toast],
  );

  useEffect(() => {
    if (initialProps?.playerId) void openDetail(initialProps.playerId);
  }, [initialProps?.playerId, openDetail]);

  const runConfirm = async (reason: string) => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "revoke") {
        await api(`sessions/${encodeURIComponent(confirm.sessionId)}/revoke`, {
          method: "POST",
          body: { reason },
        });
      } else if (confirm.kind === "freeze") {
        await api(`players/${encodeURIComponent(confirm.playerId)}/${confirm.freeze ? "freeze" : "unfreeze"}`, {
          method: "POST",
          body: { reason },
        });
      } else {
        await api(`players/${encodeURIComponent(confirm.playerId)}/${confirm.close ? "close" : "reopen"}`, {
          method: "POST",
          body: { reason },
        });
      }
      toast(t("common.success"));
      const playerId = confirm.kind === "revoke" ? confirm.playerId : confirm.playerId;
      setConfirm(null);
      void load();
      if (detail) await openDetail(playerId);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), true);
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<PlayerRow>[] = useMemo(
    () => [
      {
        key: "id",
        title: tt("players.uid"),
        render: (row) => <span className="ab-mono">{row.id.slice(0, 12)}…</span>,
      },
      {
        key: "nickname",
        title: tt("players.nickname"),
        render: (row) => row.nickname ?? <span style={{ color: "#4c6aa0" }}>—</span>,
      },
      {
        key: "contact",
        title: tt("players.contact"),
        render: (row) => (
          <span className="ab-mono">
            {row.phoneMasked || row.emailMasked || "—"}
            {row.phoneMasked && row.emailMasked ? (
              <span style={{ display: "block", opacity: 0.75 }}>{row.emailMasked}</span>
            ) : null}
          </span>
        ),
      },
      {
        key: "vip",
        title: tt("players.vip"),
        render: (row) =>
          row.vipLevel == null ? "—" : `L${row.vipLevel}${row.vipStatus ? ` · ${row.vipStatus}` : ""}`,
      },
      {
        key: "status",
        title: tt("common.status"),
        render: (row) => statusBadge(row.status, tt),
      },
      {
        key: "online",
        title: tt("players.online"),
        render: (row) =>
          row.online ? (
            <Badge tone="green">{tt("players.onlineYes")}</Badge>
          ) : (
            <Badge tone="gray">{tt("players.onlineNo")}</Badge>
          ),
      },
      {
        key: "risk",
        title: tt("players.risk"),
        render: (row) =>
          row.riskTagged ? <Badge tone="amber">{tt("players.riskYes")}</Badge> : "—",
      },
      {
        key: "createdAt",
        title: tt("common.createdAt"),
        sortable: true,
        render: (row) => fmtTime(row.createdAt),
      },
      {
        key: "lastLoginAt",
        title: tt("players.lastLogin"),
        render: (row) => fmtTime(row.lastLoginAt ?? row.lastActiveAt),
      },
      {
        key: "actions",
        title: tt("common.actions"),
        render: (row) =>
          canFreeze ? (
            <span onClick={(event) => event.stopPropagation()} style={{ display: "inline-flex", gap: 6 }}>
              {row.status === "ACTIVE" ? (
                <>
                  <button
                    className="ab-btn danger"
                    onClick={() =>
                      setConfirm({
                        kind: "freeze",
                        playerId: row.id,
                        freeze: true,
                        from: "ACTIVE",
                        to: "LOCKED",
                      })
                    }
                  >
                    {tt("players.freeze")}
                  </button>
                  <button
                    className="ab-btn danger"
                    onClick={() =>
                      setConfirm({
                        kind: "close",
                        playerId: row.id,
                        close: true,
                        from: "ACTIVE",
                        to: "CLOSED",
                      })
                    }
                  >
                    {tt("players.ban")}
                  </button>
                </>
              ) : null}
              {row.status === "LOCKED" ? (
                <button
                  className="ab-btn success"
                  onClick={() =>
                    setConfirm({
                      kind: "freeze",
                      playerId: row.id,
                      freeze: false,
                      from: "LOCKED",
                      to: "ACTIVE",
                    })
                  }
                >
                  {tt("players.unfreeze")}
                </button>
              ) : null}
              {row.status === "CLOSED" ? (
                <button
                  className="ab-btn success"
                  onClick={() =>
                    setConfirm({
                      kind: "close",
                      playerId: row.id,
                      close: false,
                      from: "CLOSED",
                      to: "ACTIVE",
                    })
                  }
                >
                  {tt("players.unban")}
                </button>
              ) : null}
            </span>
          ) : null,
      },
    ],
    [canFreeze, tt],
  );

  const confirmCopy = (() => {
    if (!confirm) return { title: "", description: "" };
    if (confirm.kind === "revoke") {
      return {
        title: tt("sessions.revoke"),
        description: `${tt("players.target")}: ${confirm.playerId}\n${tt("sessions.revokeConfirm")}`,
      };
    }
    if (confirm.kind === "freeze") {
      return {
        title: confirm.freeze ? tt("players.freeze") : tt("players.unfreeze"),
        description: `${tt("players.target")}: ${confirm.playerId}\n${tt("players.fromStatus")}: ${confirm.from} → ${confirm.to}\n${
          confirm.freeze ? tt("players.freezeConfirm") : tt("players.unfreezeConfirm")
        }`,
      };
    }
    return {
      title: confirm.close ? tt("players.ban") : tt("players.unban"),
      description: `${tt("players.target")}: ${confirm.playerId}\n${tt("players.fromStatus")}: ${confirm.from} → ${confirm.to}\n${
        confirm.close ? tt("players.banConfirm") : tt("players.unbanConfirm")
      }\n${tt("players.modelLimitationShort")}`,
    };
  })();

  const tabs: { key: DetailTab; label: string }[] = [
    { key: "overview", label: tt("players.tabOverview") },
    { key: "sessions", label: tt("players.tabSessions") },
    { key: "devices", label: tt("players.tabDevices") },
    { key: "login", label: tt("players.tabLogin") },
    { key: "game", label: tt("players.tabGame") },
    { key: "wallet", label: tt("players.tabWallet") },
  ];

  return (
    <div className="ab-players">
      <div className="ab-readonly-banner">🔒 {tt("players.balanceEditForbidden")}</div>
      <div className="ab-chip" style={{ marginBottom: 10 }}>
        {tt("players.modelLimitationShort")}
      </div>
      <div className="ab-toolbar ab-toolbar-wrap">
        <input
          className="ab-input"
          placeholder={tt("players.searchPlaceholder")}
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
          <option value="">{tt("common.all")}</option>
          <option value="ACTIVE">{tt("players.statusNormal")}</option>
          <option value="LOCKED">{tt("players.statusFrozen")}</option>
          <option value="CLOSED">{tt("players.statusBanned")}</option>
        </select>
        <select
          className="ab-select"
          value={online}
          onChange={(event) => {
            setOnline(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{tt("players.onlineAll")}</option>
          <option value="online">{tt("players.onlineYes")}</option>
          <option value="offline">{tt("players.onlineNo")}</option>
        </select>
        <select
          className="ab-select"
          value={vipMin}
          onChange={(event) => {
            setVipMin(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{tt("players.vipAll")}</option>
          <option value="1">VIP ≥ 1</option>
          <option value="3">VIP ≥ 3</option>
          <option value="5">VIP ≥ 5</option>
        </select>
        <input
          className="ab-input"
          type="date"
          value={registeredFrom}
          onChange={(event) => {
            setRegisteredFrom(event.target.value);
            setPage(1);
          }}
          title={tt("players.registeredFrom")}
        />
        <input
          className="ab-input"
          type="date"
          value={registeredTo}
          onChange={(event) => {
            setRegisteredTo(event.target.value);
            setPage(1);
          }}
          title={tt("players.registeredTo")}
        />
        <select
          className="ab-select"
          value={pageSize}
          onChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(1);
          }}
        >
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <button className="ab-btn" onClick={() => void load()}>
          ⟳ {t("common.refresh")}
        </button>
      </div>

      {listState === "error" ? <ErrorBox message={error ?? tt("common.error")} /> : null}
      {listState === "loading" && !data ? <Loading text={t("common.loading")} /> : null}
      {listState === "empty" && data ? (
        <div className="ab-panel">
          <div className="ab-chip">{t("common.empty")}</div>
        </div>
      ) : null}
      {data && listState !== "error" && listState !== "empty" ? (
        <>
          <div className="ab-table-desktop">
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
          </div>
          <div className="ab-card-list ab-table-mobile">
            {data.items.map((row) => (
              <button
                key={row.id}
                className="ab-player-card"
                onClick={() => void openDetail(row.id)}
              >
                <div className="ab-player-card-top">
                  <span className="ab-mono">{row.id.slice(0, 14)}…</span>
                  {statusBadge(row.status, tt)}
                </div>
                <div>{row.nickname ?? "—"} · {row.phoneMasked ?? "—"}</div>
                <div className="ab-chip">
                  {row.online ? tt("players.onlineYes") : tt("players.onlineNo")}
                  {row.vipLevel != null ? ` · VIP ${row.vipLevel}` : ""}
                </div>
              </button>
            ))}
          </div>
          <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      ) : null}

      {detail ? (
        <div className="ab-modal-mask" onClick={() => setDetail(null)}>
          <div className="ab-modal wide ab-player-detail" onClick={(event) => event.stopPropagation()}>
            <div className="ab-modal-title">{tt("players.detail")}</div>
            <div className="ab-tabs ab-detail-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`ab-tab${detailTab === tab.key ? " active" : ""}`}
                  onClick={() => setDetailTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {detailTab === "overview" ? (
              <div className="ab-kv" style={{ marginTop: 12 }}>
                <div className="ab-kv-item">
                  <span className="k">{tt("players.uid")}</span>
                  <span className="v ab-mono">{detail.player.id}</span>
                </div>
                <div className="ab-kv-item">
                  <span className="k">{tt("players.nickname")}</span>
                  <span className="v">{detail.player.nickname ?? "—"}</span>
                </div>
                <div className="ab-kv-item">
                  <span className="k">{tt("common.status")}</span>
                  <span className="v">{statusBadge(detail.player.status, tt)}</span>
                </div>
                <div className="ab-kv-item">
                  <span className="k">{tt("players.online")}</span>
                  <span className="v">
                    {detail.player.online ? tt("players.onlineYes") : tt("players.onlineNo")}
                  </span>
                </div>
                <div className="ab-kv-item">
                  <span className="k">{tt("players.vip")}</span>
                  <span className="v">
                    {detail.player.vipLevel == null
                      ? "—"
                      : `L${detail.player.vipLevel} · ${detail.player.vipStatus ?? ""}`}
                  </span>
                </div>
                <div className="ab-kv-item">
                  <span className="k">{tt("players.phone")}</span>
                  <span className="v">{detail.player.phoneMasked ?? "—"}</span>
                </div>
                <div className="ab-kv-item">
                  <span className="k">{tt("players.email")}</span>
                  <span className="v">{detail.player.emailMasked ?? "—"}</span>
                </div>
                <div className="ab-kv-item">
                  <span className="k">{tt("players.lastLogin")}</span>
                  <span className="v">{fmtTime(detail.player.lastLoginAt)}</span>
                </div>
                <div className="ab-kv-item">
                  <span className="k">{tt("common.ip")}</span>
                  <span className="v ab-mono">
                    {detail.player.ip ?? tt("players.noDeviceData")}
                  </span>
                </div>
                <div className="ab-kv-item">
                  <span className="k">{tt("players.device")}</span>
                  <span className="v">
                    {detail.player.device ?? tt("players.noDeviceData")}
                  </span>
                </div>
                <div className="ab-kv-item">
                  <span className="k">{tt("common.createdAt")}</span>
                  <span className="v">{fmtTime(detail.player.createdAt)}</span>
                </div>
                <div className="ab-kv-item">
                  <span className="k">{tt("players.riskTags")}</span>
                  <span className="v">
                    {detail.riskTags && detail.riskTags.length > 0
                      ? detail.riskTags.map((tag) => (
                          <Badge key={tag} tone="amber">
                            {tag}
                          </Badge>
                        ))
                      : t("common.empty")}
                  </span>
                </div>
              </div>
            ) : null}

            {detailTab === "sessions" ? (
              <DataTable
                columns={[
                  {
                    key: "id",
                    title: tt("sessions.id"),
                    render: (row) => <span className="ab-mono">{String(row.id)}</span>,
                  },
                  {
                    key: "status",
                    title: t("common.status"),
                    render: (row) => (
                      <Badge tone={row.status === "OPEN" ? "green" : "gray"}>{String(row.status)}</Badge>
                    ),
                  },
                  {
                    key: "created_at",
                    title: t("common.createdAt"),
                    render: (row) => fmtTime(String(row.created_at)),
                  },
                  {
                    key: "expires_at",
                    title: tt("sessions.expiresAt"),
                    render: (row) => fmtTime(String(row.expires_at)),
                  },
                  {
                    key: "actions",
                    title: t("common.actions"),
                    render: (row) =>
                      canRevoke && String(row.status) !== "REVOKED" && row.revokeId ? (
                        <button
                          className="ab-btn danger"
                          onClick={() =>
                            setConfirm({
                              kind: "revoke",
                              sessionId: String(row.revokeId),
                              playerId: detail.player.id,
                            })
                          }
                        >
                          {tt("sessions.revoke")}
                        </button>
                      ) : null,
                  },
                ]}
                rows={detail.sessions}
                empty={t("common.empty")}
              />
            ) : null}

            {detailTab === "devices" || detailTab === "login" ? (
              <DataTable
                columns={[
                  {
                    key: "ip",
                    title: tt("common.ip"),
                    render: (row) => <span className="ab-mono">{String(row.ip ?? "—")}</span>,
                  },
                  {
                    key: "device",
                    title: tt("players.device"),
                    render: (row) => String(row.device ?? row.userAgentSummary ?? "—"),
                  },
                  {
                    key: "lastSeenAt",
                    title: tt("players.lastSeen"),
                    render: (row) => fmtTime(String(row.lastSeenAt ?? row.createdAt ?? "")),
                  },
                ]}
                rows={detail.devices ?? detail.loginHistory ?? []}
                empty={tt("players.noDeviceData")}
              />
            ) : null}

            {detailTab === "game" ? (
              <>
                <div className="ab-kv">
                  <div className="ab-kv-item">
                    <span className="k">{tt("players.roundCount")}</span>
                    <span className="v">{detail.aggregates.roundCount}</span>
                  </div>
                  <div className="ab-kv-item">
                    <span className="k">{tt("players.totalBet")}</span>
                    <span className="v">{fmtMinor(detail.aggregates.totalBetMinor)}</span>
                  </div>
                  <div className="ab-kv-item">
                    <span className="k">{tt("players.totalWin")}</span>
                    <span className="v">{fmtMinor(detail.aggregates.totalWinMinor)}</span>
                  </div>
                </div>
                <DataTable
                  columns={[
                    {
                      key: "id",
                      title: "Round",
                      render: (row) => <span className="ab-mono">{String(row.id).slice(0, 10)}…</span>,
                    },
                    {
                      key: "status",
                      title: t("common.status"),
                      render: (row) => <Badge tone="blue">{String(row.status)}</Badge>,
                    },
                    {
                      key: "total_bet_minor",
                      title: t("rounds.betAmount"),
                      render: (row) => fmtMinor(Number(row.total_bet_minor)),
                    },
                    {
                      key: "total_win_minor",
                      title: t("rounds.winAmount"),
                      render: (row) =>
                        fmtMinor(row.total_win_minor == null ? null : Number(row.total_win_minor)),
                    },
                    {
                      key: "created_at",
                      title: t("common.time"),
                      render: (row) => fmtTime(String(row.created_at)),
                    },
                  ]}
                  rows={detail.recentRounds}
                  empty={t("common.empty")}
                  onRowClick={(row) =>
                    openTab({
                      key: `rounds:${String(row.id)}`,
                      titleKey: "nav.rounds",
                      props: {
                        roundId: String(row.id),
                        playerId: detail.player.id,
                      },
                    })
                  }
                />
              </>
            ) : null}

            {detailTab === "wallet" ? (
              <>
                <div className="ab-chip" style={{ marginBottom: 8 }}>
                  {detail.walletSummary?.note ?? tt("players.walletSummaryHint")}
                </div>
                <div className="ab-toolbar">
                  <button
                    className="ab-btn primary"
                    onClick={() =>
                      openTab({
                        key: `wallet:${detail.player.id}`,
                        titleKey: "nav.wallet",
                        props: { playerId: detail.player.id },
                      })
                    }
                  >
                    {tt("players.openWalletCenter")}
                  </button>
                  <button
                    className="ab-btn"
                    onClick={() =>
                      openTab({
                        key: `ledger:p:${detail.player.id}`,
                        titleKey: "nav.ledger",
                        props: { playerId: detail.player.id },
                      })
                    }
                  >
                    {tt("players.openLedger")}
                  </button>
                </div>
                <div className="ab-grid-stats">
                  <div className="ab-stat">
                    <div className="ab-stat-label">{tt("players.available")}</div>
                    <div className="ab-stat-value ab-money">
                      {fmtMinor(detail.walletSummary?.availableMinor ?? 0)}{" "}
                      {detail.walletSummary?.currency ?? ""}
                    </div>
                  </div>
                  <div className="ab-stat">
                    <div className="ab-stat-label">{tt("players.frozen")}</div>
                    <div className="ab-stat-value ab-money">
                      {fmtMinor(detail.walletSummary?.frozenMinor ?? 0)}{" "}
                      {detail.walletSummary?.currency ?? ""}
                    </div>
                  </div>
                  <div className="ab-stat">
                    <div className="ab-stat-label">{tt("players.totalBalance")}</div>
                    <div className="ab-stat-value ab-money">
                      {fmtMinor(detail.walletSummary?.totalMinor ?? 0)}{" "}
                      {detail.walletSummary?.currency ?? ""}
                    </div>
                  </div>
                </div>
                <DataTable
                  columns={[
                    { key: "kind", title: "Kind", render: (row) => String(row.kind) },
                    {
                      key: "balance_minor",
                      title: t("common.balance"),
                      render: (row) => fmtMinor(Number(row.balance_minor)),
                    },
                    { key: "currency", title: t("common.currency"), render: (row) => String(row.currency) },
                  ]}
                  rows={detail.ledgerAccounts}
                  empty={t("common.empty")}
                />
              </>
            ) : null}

            <div className="ab-modal-actions">
              {canFreeze && detail.player.status === "ACTIVE" ? (
                <>
                  <button
                    className="ab-btn danger"
                    onClick={() =>
                      setConfirm({
                        kind: "freeze",
                        playerId: detail.player.id,
                        freeze: true,
                        from: "ACTIVE",
                        to: "LOCKED",
                      })
                    }
                  >
                    {tt("players.freeze")}
                  </button>
                  <button
                    className="ab-btn danger"
                    onClick={() =>
                      setConfirm({
                        kind: "close",
                        playerId: detail.player.id,
                        close: true,
                        from: "ACTIVE",
                        to: "CLOSED",
                      })
                    }
                  >
                    {tt("players.ban")}
                  </button>
                </>
              ) : null}
              {canFreeze && detail.player.status === "LOCKED" ? (
                <button
                  className="ab-btn success"
                  onClick={() =>
                    setConfirm({
                      kind: "freeze",
                      playerId: detail.player.id,
                      freeze: false,
                      from: "LOCKED",
                      to: "ACTIVE",
                    })
                  }
                >
                  {tt("players.unfreeze")}
                </button>
              ) : null}
              {canFreeze && detail.player.status === "CLOSED" ? (
                <button
                  className="ab-btn success"
                  onClick={() =>
                    setConfirm({
                      kind: "close",
                      playerId: detail.player.id,
                      close: false,
                      from: "CLOSED",
                      to: "ACTIVE",
                    })
                  }
                >
                  {tt("players.unban")}
                </button>
              ) : null}
              <button className="ab-btn" onClick={() => setDetail(null)}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirm ? (
        <DangerConfirm
          title={confirmCopy.title || t("common.dangerConfirm")}
          description={confirmCopy.description}
          reasonLabel={t("common.reason")}
          reasonRequired={t("common.reasonRequired")}
          hint={t("common.dangerConfirmHint")}
          confirmLabel={t("common.confirm")}
          cancelLabel={t("common.cancel")}
          busy={busy}
          onConfirm={(reason) => void runConfirm(reason)}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}

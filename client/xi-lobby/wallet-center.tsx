"use client";

/**
 * 《西游戏》Wallet Center（钱包中心）— commercial money hub UI.
 * Presentation only; reuses wallet/deposit/withdraw/wins helpers.
 * Never invents balances, chart series, or payment history.
 */

import { useEffect, useState } from "react";
import {
  fetchWalletSnapshot,
  fetchWins,
  formatMinor,
  type LoadState,
  type LobbyBalanceView,
} from "./api.ts";
import { DepositPanel, WithdrawPanel } from "./commerce-panels.tsx";
import type { LobbyLang } from "./i18n.ts";
import "./wallet-center.css";

type TFn = (key: string) => string;

type BalanceState = LoadState<LobbyBalanceView>;

type Sheet = null | "deposit" | "withdraw" | "ledger";

type RecordTab =
  | "deposit"
  | "withdraw"
  | "game"
  | "activity"
  | "redpacket";

type LedgerFilter =
  | "all"
  | "income"
  | "expense"
  | "reward"
  | "refund"
  | "game";

type MoveRow = {
  id: string;
  kind: string;
  status: string;
  amountMinor: number;
  label: string;
  createdAt: string;
};

function classifyMove(kind: string, label: string): LedgerFilter {
  const raw = `${kind} ${label}`.toLowerCase();
  if (/(reward|bonus|gift|activity|checkin|vip)/.test(raw)) return "reward";
  if (/(refund)/.test(raw)) return "refund";
  if (/(spin|settle|win|bet|game|round)/.test(raw)) return "game";
  if (/(withdraw|debit|out|expense|spend)/.test(raw)) return "expense";
  if (/(deposit|credit|in|income|top.?up)/.test(raw)) return "income";
  return "all";
}

function matchesDate(createdAt: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const day = createdAt.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function matchesSearch(row: MoveRow, q: string): boolean {
  if (!q.trim()) return true;
  const hay = `${row.label} ${row.kind} ${row.status} ${row.id}`.toLowerCase();
  return hay.includes(q.trim().toLowerCase());
}

export type WalletCenterProps = {
  t: TFn;
  lang: LobbyLang;
  balance: BalanceState;
  onBalanceRefresh?: () => void;
};

export function WalletCenter({
  t,
  lang,
  balance,
  onBalanceRefresh,
}: WalletCenterProps) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [recordTab, setRecordTab] = useState<RecordTab>("deposit");
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [walletSnap, setWalletSnap] = useState<
    Awaited<ReturnType<typeof fetchWalletSnapshot>>
  >({ status: "loading" });
  const [wins, setWins] = useState<Awaited<ReturnType<typeof fetchWins>>>({
    status: "loading",
  });

  const balanceTick =
    balance.status === "ok" ? balance.data.balanceMinor : balance.status;

  useEffect(() => {
    let alive = true;
    void fetchWalletSnapshot().then((r) => {
      if (alive) setWalletSnap(r);
    });
    return () => {
      alive = false;
    };
  }, [balanceTick]);

  useEffect(() => {
    if (recordTab !== "game") return;
    let alive = true;
    setWins({ status: "loading" });
    void fetchWins().then((r) => {
      if (alive) setWins(r);
    });
    return () => {
      alive = false;
    };
  }, [recordTab]);

  useEffect(() => {
    setPage(1);
  }, [recordTab, ledgerFilter, search, dateFrom, dateTo, sheet]);

  const mmkCurrency =
    balance.status === "ok"
      ? balance.data.currency
      : walletSnap.status === "ok"
        ? walletSnap.data.currency
        : "MMK";

  const mmkAvailableText =
    balance.status === "loading" || walletSnap.status === "loading"
      ? t("lobby.loading")
      : balance.status === "error" && walletSnap.status === "error"
        ? t("lobby.wallet.error")
        : balance.status === "ok"
          ? formatMinor(balance.data.balanceMinor, balance.data.currency)
          : walletSnap.status === "ok"
            ? formatMinor(walletSnap.data.availableMinor, walletSnap.data.currency)
            : t("lobby.wallet.error");

  const mmkFrozenText =
    walletSnap.status === "loading"
      ? t("lobby.loading")
      : walletSnap.status === "ok"
        ? formatMinor(walletSnap.data.frozenMinor, walletSnap.data.currency)
        : "—";

  const totalText =
    balance.status === "ok"
      ? `${formatMinor(balance.data.balanceMinor, balance.data.currency)} ${balance.data.currency}`
      : walletSnap.status === "ok"
        ? `${formatMinor(
            walletSnap.data.availableMinor + walletSnap.data.frozenMinor,
            walletSnap.data.currency,
          )} ${walletSnap.data.currency}`
        : balance.status === "loading" || walletSnap.status === "loading"
          ? t("lobby.loading")
          : t("lobby.wc.noData");

  const usdtSupported =
    walletSnap.status === "ok" ? walletSnap.data.usdtSupported : false;
  const usdtText =
    walletSnap.status === "loading"
      ? t("lobby.loading")
      : usdtSupported
        ? t("lobby.commerce.usdtLive")
        : t("lobby.wallet.usdt.pending");

  const moves: MoveRow[] =
    walletSnap.status === "ok" ? walletSnap.data.recentMoves : [];

  const filteredMoves = moves.filter((m) => {
    if (!matchesDate(m.createdAt, dateFrom, dateTo)) return false;
    if (!matchesSearch(m, search)) return false;
    if (ledgerFilter === "all") return true;
    const cls = classifyMove(m.kind, m.label);
    return cls === ledgerFilter;
  });

  const pageCount = Math.max(1, Math.ceil(filteredMoves.length / pageSize));
  const pageSafe = Math.min(page, pageCount);
  const pageRows = filteredMoves.slice(
    (pageSafe - 1) * pageSize,
    pageSafe * pageSize,
  );

  const filteredWins =
    wins.status !== "ok"
      ? []
      : wins.data.filter((w) => {
          if (!matchesDate(w.createdAt, dateFrom, dateTo)) return false;
          if (!search.trim()) return true;
          const hay = `${w.roundId} ${w.createdAt}`.toLowerCase();
          return hay.includes(search.trim().toLowerCase());
        });

  const winsPageCount = Math.max(1, Math.ceil(filteredWins.length / pageSize));
  const winsPageSafe = Math.min(page, winsPageCount);
  const winsPageRows = filteredWins.slice(
    (winsPageSafe - 1) * pageSize,
    winsPageSafe * pageSize,
  );

  function openSheet(next: Sheet) {
    setSheet(next);
  }

  function refreshAll() {
    onBalanceRefresh?.();
    void fetchWalletSnapshot().then(setWalletSnap);
  }

  return (
    <div className="xi-wc" data-testid="xi-wallet-center">
      {/* Top: total + currencies + trend reserved */}
      <section className="xi-wc-hero" data-testid="xi-wc-hero">
        <div className="xi-wc-hero-top">
          <h2 className="xi-wc-title">{t("lobby.wc.title")}</h2>
          <span className="xi-wc-badge" data-testid="xi-wc-harness-badge">
            {t("lobby.wc.harnessBadge")}
          </span>
        </div>
        <p className="xi-wc-total-label">{t("lobby.wc.totalAssets")}</p>
        <p className="xi-wc-total" data-testid="xi-wc-total">
          {totalText}
        </p>
        <div className="xi-wc-summary-row">
          <div className="xi-wc-summary">
            <span className="xi-wc-code">{mmkCurrency}</span>
            <strong data-testid="xi-wc-mmk-summary">{mmkAvailableText}</strong>
          </div>
          <div className="xi-wc-summary is-usdt">
            <span className="xi-wc-code">{t("lobby.balance.usdt")}</span>
            <strong data-testid="xi-wc-usdt-summary">{usdtText}</strong>
          </div>
        </div>
        <div
          className="xi-wc-trend"
          data-testid="xi-wc-trend"
          aria-label={t("lobby.wc.trend")}
        >
          <span className="xi-wc-trend-label">{t("lobby.wc.trend")}</span>
          <span className="xi-wc-nodata">{t("lobby.wc.trendReserved")}</span>
        </div>
      </section>

      {/* Asset cards */}
      <section className="xi-wc-cards" data-testid="xi-wc-cards">
        <article className="xi-wc-card">
          <header className="xi-wc-card-head">
            <h3>{mmkCurrency}</h3>
            <span className="xi-wc-muted">
              {t("lobby.commerce.frozen")}: {mmkFrozenText}
            </span>
          </header>
          <p className="xi-wc-card-amt" data-testid="xi-wc-mmk-balance">
            {mmkAvailableText}
          </p>
          <div className="xi-wc-card-actions">
            <button
              type="button"
              className="xi-wc-btn primary"
              data-testid="xi-wc-deposit"
              onClick={() => openSheet("deposit")}
            >
              {t("lobby.feat.recharge")}
            </button>
            <button
              type="button"
              className="xi-wc-btn"
              data-testid="xi-wc-withdraw"
              onClick={() => openSheet("withdraw")}
            >
              {t("lobby.feat.withdraw")}
            </button>
            <button
              type="button"
              className="xi-wc-btn"
              data-testid="xi-wc-ledger"
              onClick={() => openSheet("ledger")}
            >
              {t("lobby.wc.ledger")}
            </button>
          </div>
        </article>

        <article className="xi-wc-card is-usdt">
          <header className="xi-wc-card-head">
            <h3>{t("lobby.balance.usdt")}</h3>
            <span className="xi-wc-muted">{t("lobby.wc.usdtRail")}</span>
          </header>
          <p className="xi-wc-card-amt" data-testid="xi-wc-usdt-balance">
            {usdtText}
          </p>
          <div className="xi-wc-card-actions">
            <button
              type="button"
              className="xi-wc-btn"
              data-testid="xi-wc-usdt-deposit"
              onClick={() => openSheet("deposit")}
            >
              {t("lobby.feat.recharge")}
            </button>
            <button
              type="button"
              className="xi-wc-btn"
              data-testid="xi-wc-usdt-withdraw"
              onClick={() => openSheet("withdraw")}
            >
              {t("lobby.feat.withdraw")}
            </button>
            <button
              type="button"
              className="xi-wc-btn"
              data-testid="xi-wc-usdt-ledger"
              onClick={() => openSheet("ledger")}
            >
              {t("lobby.wc.ledger")}
            </button>
          </div>
        </article>
      </section>

      {/* Funds records */}
      <section className="xi-wc-records" data-testid="xi-wc-records">
        <h3 className="xi-wc-section-title">{t("lobby.wc.records")}</h3>
        <div className="xi-wc-tabs" role="tablist" aria-label={t("lobby.wc.records")}>
          {(
            [
              ["deposit", "lobby.wc.tab.deposit"],
              ["withdraw", "lobby.wc.tab.withdraw"],
              ["game", "lobby.wc.tab.game"],
              ["activity", "lobby.wc.tab.activity"],
              ["redpacket", "lobby.wc.tab.redpacket"],
            ] as const
          ).map(([id, key]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={recordTab === id}
              className={`xi-wc-tab${recordTab === id ? " is-active" : ""}`}
              data-testid={`xi-wc-tab-${id}`}
              onClick={() => setRecordTab(id)}
            >
              {t(key)}
            </button>
          ))}
        </div>

        <div className="xi-wc-filters" data-testid="xi-wc-filters">
          <label className="xi-wc-filter">
            <span>{t("lobby.wc.filter.from")}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              data-testid="xi-wc-date-from"
            />
          </label>
          <label className="xi-wc-filter">
            <span>{t("lobby.wc.filter.to")}</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              data-testid="xi-wc-date-to"
            />
          </label>
          <label className="xi-wc-filter xi-wc-filter-search">
            <span>{t("lobby.wc.filter.search")}</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("lobby.wc.filter.searchPh")}
              data-testid="xi-wc-search"
            />
          </label>
        </div>

        {recordTab === "game" ? (
          <div data-testid="xi-wc-game-list">
            {wins.status === "loading" && <p className="xi-wc-empty">{t("lobby.loading")}</p>}
            {wins.status === "error" && (
              <p className="xi-wc-empty">{t("lobby.commerce.error")}</p>
            )}
            {wins.status === "ok" && filteredWins.length === 0 && (
              <p className="xi-wc-empty" data-testid="xi-wc-game-empty">
                {t("lobby.wc.empty.game")}
              </p>
            )}
            {wins.status === "ok" && filteredWins.length > 0 && (
              <>
                <ul className="xi-wc-list">
                  {winsPageRows.map((w) => (
                    <li key={w.roundId}>
                      <strong>
                        {w.roundId.slice(0, 8)} · {t("lobby.wc.game.bet")}{" "}
                        {formatMinor(w.betMinor, mmkCurrency)} · {t("lobby.wc.game.win")}{" "}
                        {formatMinor(w.winMinor, mmkCurrency)}
                      </strong>
                      <span>{w.createdAt}</span>
                    </li>
                  ))}
                </ul>
                <div className="xi-wc-pager">
                  <button
                    type="button"
                    className="xi-wc-btn"
                    disabled={winsPageSafe <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t("lobby.wc.page.prev")}
                  </button>
                  <span>
                    {winsPageSafe}/{winsPageCount}
                  </span>
                  <button
                    type="button"
                    className="xi-wc-btn"
                    disabled={winsPageSafe >= winsPageCount}
                    onClick={() => setPage((p) => Math.min(winsPageCount, p + 1))}
                  >
                    {t("lobby.wc.page.next")}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {recordTab === "deposit" && (
          <p className="xi-wc-empty" data-testid="xi-wc-deposit-empty">
            {t("lobby.wc.empty.deposit")}
          </p>
        )}
        {recordTab === "withdraw" && (
          <div data-testid="xi-wc-withdraw-history">
            <p className="xi-wc-status-shell">{t("lobby.wc.withdraw.statusShell")}</p>
            <p className="xi-wc-empty">{t("lobby.wc.empty.withdraw")}</p>
          </div>
        )}
        {recordTab === "activity" && (
          <p className="xi-wc-empty" data-testid="xi-wc-activity-empty">
            {t("lobby.wc.empty.activity")}
          </p>
        )}
        {recordTab === "redpacket" && (
          <p className="xi-wc-empty" data-testid="xi-wc-redpacket-empty">
            {t("lobby.wc.empty.redpacket")}
          </p>
        )}
      </section>

      {/* Sheets: deposit / withdraw / ledger */}
      {sheet && (
        <div
          className="xi-wc-sheet-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheet(null);
          }}
        >
          <div
            className="xi-wc-sheet"
            role="dialog"
            aria-modal="true"
            data-testid={`xi-wc-sheet-${sheet}`}
          >
            <header className="xi-wc-sheet-head">
              <h3>
                {sheet === "deposit" && t("lobby.feat.recharge")}
                {sheet === "withdraw" && t("lobby.feat.withdraw")}
                {sheet === "ledger" && t("lobby.wc.ledger")}
              </h3>
              <button
                type="button"
                className="xi-wc-btn"
                data-testid="xi-wc-sheet-close"
                onClick={() => setSheet(null)}
              >
                {t("lobby.close")}
              </button>
            </header>

            {sheet === "deposit" && (
              <div className="xi-wc-deposit" data-testid="xi-wc-deposit-shell">
                <p className="xi-wc-rail-note">{t("lobby.wc.deposit.rails")}</p>
                <div className="xi-wc-rails" role="list">
                  <span className="xi-wc-rail is-active" role="listitem">
                    MMK
                  </span>
                  <span className="xi-wc-rail is-reserved" role="listitem">
                    USDT · {t("lobby.me.reserved")}
                  </span>
                  <span className="xi-wc-rail is-reserved" role="listitem">
                    ZRHPay · {t("lobby.me.reserved")}
                  </span>
                </div>
                <DepositPanel t={t} lang={lang} onBalanceRefresh={refreshAll} />
              </div>
            )}

            {sheet === "withdraw" && (
              <div className="xi-wc-withdraw" data-testid="xi-wc-withdraw-shell">
                <p className="xi-wc-status-shell">{t("lobby.wc.withdraw.reviewShell")}</p>
                <WithdrawPanel t={t} lang={lang} onBalanceRefresh={refreshAll} />
                <div className="xi-wc-wd-history">
                  <h4 className="xi-wc-section-title">{t("lobby.wc.withdraw.history")}</h4>
                  <p className="xi-wc-empty">{t("lobby.wc.empty.withdraw")}</p>
                </div>
              </div>
            )}

            {sheet === "ledger" && (
              <div className="xi-wc-ledger" data-testid="xi-wc-ledger-shell">
                <div className="xi-wc-type-filters" role="tablist">
                  {(
                    [
                      ["all", "lobby.wc.ledger.all"],
                      ["income", "lobby.wc.ledger.income"],
                      ["expense", "lobby.wc.ledger.expense"],
                      ["reward", "lobby.wc.ledger.reward"],
                      ["refund", "lobby.wc.ledger.refund"],
                      ["game", "lobby.wc.ledger.game"],
                    ] as const
                  ).map(([id, key]) => (
                    <button
                      key={id}
                      type="button"
                      className={`xi-wc-chip${ledgerFilter === id ? " is-active" : ""}`}
                      data-testid={`xi-wc-ledger-filter-${id}`}
                      onClick={() => setLedgerFilter(id)}
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
                <div className="xi-wc-filters">
                  <label className="xi-wc-filter">
                    <span>{t("lobby.wc.filter.from")}</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </label>
                  <label className="xi-wc-filter">
                    <span>{t("lobby.wc.filter.to")}</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </label>
                  <label className="xi-wc-filter xi-wc-filter-search">
                    <span>{t("lobby.wc.filter.search")}</span>
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t("lobby.wc.filter.searchPh")}
                    />
                  </label>
                </div>
                {walletSnap.status === "loading" && (
                  <p className="xi-wc-empty">{t("lobby.loading")}</p>
                )}
                {walletSnap.status === "error" && (
                  <p className="xi-wc-empty">{t("lobby.wallet.error")}</p>
                )}
                {walletSnap.status === "ok" && filteredMoves.length === 0 && (
                  <p className="xi-wc-empty" data-testid="xi-wc-ledger-empty">
                    {t("lobby.commerce.noMoves")}
                  </p>
                )}
                {walletSnap.status === "ok" && filteredMoves.length > 0 && (
                  <>
                    <ul className="xi-wc-list">
                      {pageRows.map((m) => (
                        <li key={m.id}>
                          <strong>
                            {m.label} · {m.status}
                          </strong>
                          <span>
                            {formatMinor(m.amountMinor, mmkCurrency)} · {m.createdAt}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="xi-wc-pager">
                      <button
                        type="button"
                        className="xi-wc-btn"
                        disabled={pageSafe <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        {t("lobby.wc.page.prev")}
                      </button>
                      <span>
                        {pageSafe}/{pageCount}
                      </span>
                      <button
                        type="button"
                        className="xi-wc-btn"
                        disabled={pageSafe >= pageCount}
                        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                      >
                        {t("lobby.wc.page.next")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

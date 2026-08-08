"use client";

/**
 * Step 4 commerce panels — deposit / withdraw / activity / check-in / wallet / records.
 * Additive UI only; never mutates client balance (server refresh after actions).
 */

import { useEffect, useState } from "react";
import {
  claimActivity,
  claimCheckin,
  confirmDepositTest,
  createDeposit,
  createWithdraw,
  fetchActivities,
  fetchCheckin,
  fetchDepositChannels,
  fetchWalletSnapshot,
  fetchRankings,
  fetchWins,
  fetchWithdrawMeta,
  fetchVipLevels,
  formatMinor,
  type LoadState,
} from "./api.ts";
import type { LobbyLang } from "./i18n.ts";

type TFn = (key: string) => string;

function titleOf(title: Record<string, string>, lang: LobbyLang): string {
  if (lang === "en") return title.en ?? title["zh-CN"] ?? Object.values(title)[0] ?? "";
  if (lang === "my-MM") return title["my-MM"] ?? title.en ?? title["zh-CN"] ?? "";
  return title["zh-CN"] ?? title.en ?? Object.values(title)[0] ?? "";
}

function newIdem(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function DepositPanel({
  t,
  lang,
  onBalanceRefresh,
}: {
  t: TFn;
  lang: LobbyLang;
  onBalanceRefresh?: () => void;
}) {
  const [channels, setChannels] = useState<LoadState<{
    presetsMinor: number[];
    channels: Array<{ code: string; title: Record<string, string>; currency: string }>;
    readiness: {
      productionReady: boolean;
      code: string;
      reason: string;
      testHarnessAllowed: boolean;
    };
  }>>({ status: "loading" });
  const [channelCode, setChannelCode] = useState("");
  const [amountMinor, setAmountMinor] = useState(0);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchDepositChannels().then((r) => {
      setChannels(r);
      if (r.status === "ok") {
        setChannelCode(r.data.channels[0]?.code ?? "");
        setAmountMinor(r.data.presetsMinor[0] ?? 0);
      }
    });
  }, []);

  async function submit() {
    if (!channelCode || !amountMinor) return;
    setBusy(true);
    setMsg(null);
    const result = await createDeposit({
      channelCode,
      amountMinor,
      idempotencyKey: newIdem("dep"),
    });
    setBusy(false);
    if (!result.ok) {
      setMsg(result.message);
      return;
    }
    setOrderId(result.orderId);
    setMsg(t("lobby.commerce.depositCreated"));
  }

  async function confirmTest() {
    if (!orderId) return;
    if (channels.status === "ok" && !channels.data.readiness.testHarnessAllowed) {
      setMsg(t("lobby.commerce.notProductionReady"));
      return;
    }
    setBusy(true);
    const result = await confirmDepositTest(orderId);
    setBusy(false);
    if (!result.ok) {
      setMsg(
        result.code === "PROVIDER_NOT_CONFIGURED"
          ? t("lobby.commerce.notProductionReady")
          : result.message,
      );
      return;
    }
    setMsg(t("lobby.commerce.depositSuccess"));
    onBalanceRefresh?.();
  }

  if (channels.status === "loading") return <p>{t("lobby.loading")}</p>;
  if (channels.status === "error") return <p>{t("lobby.commerce.error")}</p>;

  const notProd = !channels.data.readiness.productionReady;

  return (
    <div className="xi-commerce-panel" data-testid="xi-deposit-panel">
      {notProd ? (
        <p
          className="xi-readiness-banner"
          data-testid="xi-deposit-not-prod"
          data-code={channels.data.readiness.code}
        >
          {t("lobby.commerce.notProductionReady")}
        </p>
      ) : null}
      <p className="xi-status-line">{t("lobby.commerce.depositHint")}</p>
      <label className="xi-commerce-label">
        {t("lobby.commerce.channel")}
        <select
          value={channelCode}
          onChange={(e) => setChannelCode(e.target.value)}
        >
          {channels.data.channels.map((c) => (
            <option key={c.code} value={c.code}>
              {titleOf(c.title, lang)} ({c.code})
            </option>
          ))}
        </select>
      </label>
      <div className="xi-commerce-presets">
        {channels.data.presetsMinor.map((n) => (
          <button
            key={n}
            type="button"
            className={amountMinor === n ? "xi-primary" : "xi-secondary"}
            onClick={() => setAmountMinor(n)}
          >
            {formatMinor(n, "MMK")}
          </button>
        ))}
      </div>
      <div className="xi-modal-actions">
        <button type="button" className="xi-primary" disabled={busy} onClick={() => void submit()}>
          {t("lobby.commerce.createOrder")}
        </button>
        {orderId && channels.data.readiness.testHarnessAllowed ? (
          <button
            type="button"
            className="xi-secondary"
            disabled={busy}
            onClick={() => void confirmTest()}
            data-temp="true"
          >
            {t("lobby.commerce.testConfirm")} ({t("lobby.commerce.tempHarness")})
          </button>
        ) : null}
      </div>
      {msg ? <p className="xi-status-line">{msg}</p> : null}
    </div>
  );
}

export function WithdrawPanel({
  t,
  lang,
  onBalanceRefresh,
}: {
  t: TFn;
  lang: LobbyLang;
  onBalanceRefresh?: () => void;
}) {
  const [meta, setMeta] = useState<LoadState<{
    minMinor: number;
    maxMinor: number;
    feeMinor: number;
    channels: Array<{ code: string; title: Record<string, string> }>;
    readiness: {
      productionReady: boolean;
      code: string;
      reason: string;
      testHarnessAllowed: boolean;
    };
  }>>({ status: "loading" });
  const [channelCode, setChannelCode] = useState("");
  const [account, setAccount] = useState("");
  const [amountMinor, setAmountMinor] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchWithdrawMeta().then((r) => {
      setMeta(r);
      if (r.status === "ok") {
        setChannelCode(r.data.channels[0]?.code ?? "");
        setAmountMinor(r.data.minMinor);
      }
    });
  }, []);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const result = await createWithdraw({
      channelCode,
      account,
      amountMinor,
      idempotencyKey: newIdem("wd"),
    });
    setBusy(false);
    if (!result.ok) {
      setMsg(result.message);
      return;
    }
    setMsg(t("lobby.commerce.withdrawCreated"));
    onBalanceRefresh?.();
  }

  if (meta.status === "loading") return <p>{t("lobby.loading")}</p>;
  if (meta.status === "error") return <p>{t("lobby.commerce.error")}</p>;

  const expected = Math.max(0, amountMinor - meta.data.feeMinor);
  const notProd = !meta.data.readiness.productionReady;

  return (
    <div className="xi-commerce-panel" data-testid="xi-withdraw-panel">
      {notProd ? (
        <p
          className="xi-readiness-banner"
          data-testid="xi-withdraw-not-prod"
          data-code={meta.data.readiness.code}
        >
          {t("lobby.commerce.notProductionReady")}
        </p>
      ) : null}
      <p className="xi-status-line">{t("lobby.commerce.withdrawHint")}</p>
      <p className="xi-status-line">
        {t("lobby.commerce.fee")}: {formatMinor(meta.data.feeMinor, "MMK")} ·{" "}
        {t("lobby.commerce.expected")}: {formatMinor(expected, "MMK")}
        {" · "}
        {t("lobby.commerce.placeholderLimits")}
      </p>
      <label className="xi-commerce-label">
        {t("lobby.commerce.channel")}
        <select value={channelCode} onChange={(e) => setChannelCode(e.target.value)}>
          {meta.data.channels.map((c) => (
            <option key={c.code} value={c.code}>
              {titleOf(c.title, lang)} ({c.code})
            </option>
          ))}
        </select>
      </label>
      <label className="xi-commerce-label">
        {t("lobby.commerce.account")}
        <input value={account} onChange={(e) => setAccount(e.target.value)} />
      </label>
      <label className="xi-commerce-label">
        {t("lobby.commerce.amount")}
        <input
          type="number"
          value={amountMinor || ""}
          min={meta.data.minMinor}
          max={meta.data.maxMinor}
          onChange={(e) => setAmountMinor(Number(e.target.value))}
        />
      </label>
      <div className="xi-modal-actions">
        <button type="button" className="xi-primary" disabled={busy} onClick={() => void submit()}>
          {t("lobby.commerce.submitWithdraw")}
        </button>
      </div>
      {msg ? <p className="xi-status-line">{msg}</p> : null}
    </div>
  );
}

export function WalletPanel({ t }: { t: TFn }) {
  const [wallet, setWallet] = useState<Awaited<ReturnType<typeof fetchWalletSnapshot>>>({
    status: "loading",
  });
  useEffect(() => {
    void fetchWalletSnapshot().then(setWallet);
  }, []);
  if (wallet.status === "loading") return <p>{t("lobby.loading")}</p>;
  if (wallet.status === "error") return <p>{t("lobby.wallet.error")}</p>;
  return (
    <div className="xi-commerce-panel" data-testid="xi-wallet-panel">
      <p className="xi-status-line">
        {t("lobby.commerce.available")}: {formatMinor(wallet.data.availableMinor, wallet.data.currency)}{" "}
        {wallet.data.currency}
      </p>
      <p className="xi-status-line">
        {t("lobby.commerce.frozen")}: {formatMinor(wallet.data.frozenMinor, wallet.data.currency)}
      </p>
      <p className="xi-status-line">
        {t("lobby.balance.usdt")}:{" "}
        {wallet.data.usdtSupported ? t("lobby.commerce.usdtLive") : t("lobby.wallet.usdt.pending")}
      </p>
      <ul className="xi-announce-list">
        {wallet.data.recentMoves.length === 0 ? (
          <li>{t("lobby.commerce.noMoves")}</li>
        ) : (
          wallet.data.recentMoves.slice(0, 8).map((m) => (
            <li key={m.id}>
              <strong>
                {m.label} · {m.status}
              </strong>
              <div>
                {formatMinor(m.amountMinor, wallet.data.currency)} · {m.createdAt}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function ActivityPanel({
  t,
  lang,
  onBalanceRefresh,
}: {
  t: TFn;
  lang: LobbyLang;
  onBalanceRefresh?: () => void;
}) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchActivities>>>({
    status: "loading",
  });
  const [msg, setMsg] = useState<string | null>(null);

  const reload = () => void fetchActivities().then(setItems);
  useEffect(() => {
    reload();
  }, []);

  async function onClaim(id: string) {
    const result = await claimActivity(id);
    setMsg(result.ok ? t("lobby.commerce.claimOk") : result.message);
    if (result.ok) {
      onBalanceRefresh?.();
      reload();
    }
  }

  if (items.status === "loading") return <p>{t("lobby.loading")}</p>;
  if (items.status === "error") return <p>{t("lobby.commerce.error")}</p>;

  return (
    <div className="xi-commerce-panel" data-testid="xi-activity-panel">
      <ul className="xi-announce-list">
        {items.data.map((a) => (
          <li key={a.id}>
            <strong>
              {titleOf(a.title, lang)} ({a.code})
            </strong>
            <div>
              {formatMinor(a.rewardMinor, "MMK")} ·{" "}
              {a.claimed
                ? t("lobby.commerce.claimed")
                : a.joinable
                  ? t("lobby.commerce.claimable")
                  : a.lockedReason ?? t("lobby.commerce.locked")}
            </div>
            {a.joinable ? (
              <button type="button" className="xi-primary" onClick={() => void onClaim(a.id)}>
                {t("lobby.commerce.claim")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {msg ? <p className="xi-status-line">{msg}</p> : null}
    </div>
  );
}

export function CheckinPanel({
  t,
  onBalanceRefresh,
}: {
  t: TFn;
  onBalanceRefresh?: () => void;
}) {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchCheckin>>>({
    status: "loading",
  });
  const [msg, setMsg] = useState<string | null>(null);

  const reload = () => void fetchCheckin().then(setStatus);
  useEffect(() => {
    reload();
  }, []);

  async function onClaim() {
    const result = await claimCheckin();
    setMsg(result.ok ? t("lobby.commerce.claimOk") : result.message);
    if (result.ok) {
      onBalanceRefresh?.();
      reload();
    }
  }

  if (status.status === "loading") return <p>{t("lobby.loading")}</p>;
  if (status.status === "error") return <p>{t("lobby.commerce.error")}</p>;

  return (
    <div className="xi-commerce-panel" data-testid="xi-checkin-panel">
      <p className="xi-status-line">
        {t("lobby.commerce.day")}: {status.data.dayKey}
      </p>
      <p className="xi-status-line">
        {t("lobby.commerce.reward")}: {formatMinor(status.data.rewardMinor, "MMK")}
      </p>
      <p className="xi-status-line">
        {status.data.claimed
          ? t("lobby.commerce.claimed")
          : status.data.claimable
            ? t("lobby.commerce.claimable")
            : t("lobby.commerce.locked")}
      </p>
      {status.data.claimable ? (
        <button type="button" className="xi-primary" onClick={() => void onClaim()}>
          {t("lobby.feat.checkin")}
        </button>
      ) : null}
      {msg ? <p className="xi-status-line">{msg}</p> : null}
    </div>
  );
}

export function RankingsPanel({ t }: { t: TFn }) {
  const [range, setRange] = useState<"today" | "7d" | "30d">("7d");
  const [state, setState] = useState<Awaited<ReturnType<typeof fetchRankings>>>({
    status: "loading",
  });
  useEffect(() => {
    let alive = true;
    void fetchRankings(range).then((result) => {
      if (alive) setState(result);
    });
    return () => {
      alive = false;
    };
  }, [range]);
  return (
    <div className="xi-commerce-panel" data-testid="xi-rankings-panel">
      <div className="xi-lang-row" role="tablist" aria-label="range">
        {(["today", "7d", "30d"] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={`xi-icon-btn${range === key ? " is-active" : ""}`}
            data-testid={`xi-rankings-range-${key}`}
            onClick={() => {
              setRange(key);
              setState({ status: "loading" });
            }}
          >
            {t(`lobby.bdk.rankings.range.${key}`)}
          </button>
        ))}
      </div>
      {state.status === "loading" && <p>{t("lobby.loading")}</p>}
      {state.status === "error" && <p>{t("lobby.commerce.error")}</p>}
      {state.status === "ok" && state.data.items.length === 0 && (
        <p>{t("lobby.bdk.rankings.empty")}</p>
      )}
      {state.status === "ok" && state.data.items.length > 0 && (
        <ul className="xi-announce-list">
          {state.data.items.map((row) => (
            <li key={`${row.range}-${row.rank}-${row.playerIdMasked}`}>
              <strong>
                #{row.rank} {row.nicknameMasked}
              </strong>
              <div>
                {formatMinor(row.winAmountMinor, row.currency)} · {row.game}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RecordsPanel({ t }: { t: TFn }) {
  const [wins, setWins] = useState<Awaited<ReturnType<typeof fetchWins>>>({ status: "loading" });
  useEffect(() => {
    void fetchWins().then(setWins);
  }, []);
  if (wins.status === "loading") return <p>{t("lobby.loading")}</p>;
  if (wins.status === "error") return <p>{t("lobby.commerce.error")}</p>;
  if (wins.data.length === 0) return <p>{t("lobby.bdk.records.empty")}</p>;
  return (
    <ul className="xi-announce-list" data-testid="xi-records-panel">
      {wins.data.map((w) => (
        <li key={w.roundId}>
          <strong>{w.roundId.slice(0, 8)}</strong>
          <div>
            bet {formatMinor(w.betMinor, "MMK")} · win {formatMinor(w.winMinor, "MMK")} ·{" "}
            {w.createdAt}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function VipCenterPanel({ t, lang }: { t: TFn; lang: LobbyLang }) {
  const [vip, setVip] = useState<Awaited<ReturnType<typeof fetchVipLevels>>>({
    status: "loading",
  });
  useEffect(() => {
    void fetchVipLevels().then(setVip);
  }, []);
  if (vip.status === "loading") return <p>{t("lobby.loading")}</p>;
  if (vip.status === "error") return <p>{t("lobby.bdk.vip.shell")}</p>;
  return (
    <div className="xi-commerce-panel" data-testid="xi-vip-panel">
      <p className="xi-status-line">
        VIP {vip.data.level} · {vip.data.status}
      </p>
      <ul className="xi-announce-list">
        {vip.data.levels.map((lv) => (
          <li key={lv.level}>
            <strong>
              L{lv.level} {lv.code}
            </strong>
            <div>{titleOf(lv.title, lang)}</div>
          </li>
        ))}
      </ul>
      <p className="xi-status-line">{t("lobby.bdk.vip.shell")}</p>
    </div>
  );
}

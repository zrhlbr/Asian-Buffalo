"use client";

/**
 * 《西游戏》Player Center（我的）— commercial Me tab.
 * Presentation only; reuses profile/wallet/VIP/commerce/auth helpers.
 * Never invents balances, jackpots, or security logs.
 */

import { useEffect, useState } from "react";
import {
  fetchWalletSnapshot,
  formatMinor,
  type LoadState,
  type LobbyBalanceView,
  type LobbyProfileView,
} from "./api.ts";
import { RecordsPanel, WalletPanel } from "./commerce-panels.tsx";
import type { LobbyLang } from "./i18n.ts";
import { LOBBY_LANGS, saveLobbyLang } from "./i18n.ts";
import { navigateXi, XI_ROUTES } from "./nav.ts";
import "./player-center.css";

type TFn = (key: string) => string;

type ProfileState = LoadState<LobbyProfileView>;
type BalanceState = LoadState<LobbyBalanceView>;

type LocalSheet =
  | null
  | "ledger"
  | "records"
  | "security"
  | "help"
  | "about"
  | "cs";

const LANG_LABEL: Record<LobbyLang, string> = {
  "zh-CN": "中文",
  "my-MM": "မြန်မာ",
  en: "EN",
};

function shortPlayerId(raw: string | null | undefined): string {
  if (!raw) return "————";
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 6) return digits.slice(-6);
  if (raw.length >= 6) return raw.slice(-6);
  return raw;
}

export type PlayerCenterProps = {
  t: TFn;
  lang: LobbyLang;
  profile: ProfileState;
  balance: BalanceState;
  hasAuthSession: boolean;
  onOpenProfile: () => void;
  onOpenVip: () => void;
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onOpenActivity: () => void;
  onOpenCheckin: () => void;
  onOpenRankings: () => void;
  onOpenComingSoon: (titleKey: string) => void;
  onLogout: () => void;
};

export function PlayerCenter({
  t,
  lang,
  profile,
  balance,
  hasAuthSession,
  onOpenProfile,
  onOpenVip,
  onOpenDeposit,
  onOpenWithdraw,
  onOpenActivity,
  onOpenCheckin,
  onOpenRankings,
  onOpenComingSoon,
  onLogout,
}: PlayerCenterProps) {
  const [sheet, setSheet] = useState<LocalSheet>(null);
  const [walletSnap, setWalletSnap] = useState<
    Awaited<ReturnType<typeof fetchWalletSnapshot>>
  >({ status: "loading" });

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

  const nickname =
    profile.status === "ok" && profile.data.nickname
      ? profile.data.nickname
      : profile.status === "loading"
        ? t("lobby.loading")
        : t("lobby.profile.guest");

  const playerIdLabel =
    profile.status === "ok"
      ? shortPlayerId(profile.data.playerId)
      : profile.status === "loading"
        ? "······"
        : "————";

  const vipLabel =
    profile.status === "ok" && profile.data.vipLevel != null
      ? `${t("lobby.vip")} ${profile.data.vipLevel}`
      : t("lobby.vip");

  const mmkCurrency =
    balance.status === "ok" ? balance.data.currency : t("lobby.balance.mmk");
  const mmkText =
    balance.status === "loading"
      ? t("lobby.loading")
      : balance.status === "error"
        ? balance.code === "UNAUTHORIZED"
          ? t("lobby.unavailable")
          : t("lobby.wallet.error")
        : formatMinor(balance.data.balanceMinor, balance.data.currency);

  const usdtSupported =
    walletSnap.status === "ok" ? walletSnap.data.usdtSupported : false;
  const usdtText =
    walletSnap.status === "loading"
      ? t("lobby.loading")
      : usdtSupported
        ? t("lobby.commerce.usdtLive")
        : t("lobby.unavailable");

  /** Total: only real MMK amounts — never invent USDT into a fake sum. */
  const totalText =
    balance.status === "loading"
      ? t("lobby.loading")
      : balance.status === "error"
        ? balance.code === "UNAUTHORIZED"
          ? t("lobby.unavailable")
          : t("lobby.wallet.error")
        : `${formatMinor(balance.data.balanceMinor, balance.data.currency)} ${balance.data.currency}`;

  const avatarStyle =
    profile.status === "ok" && profile.data.avatarUrl
      ? {
          backgroundImage: `url(${profile.data.avatarUrl})`,
          backgroundSize: "cover" as const,
        }
      : undefined;

  function openSheet(next: LocalSheet) {
    setSheet(next);
  }

  function closeSheet() {
    setSheet(null);
  }

  function onChangePassword() {
    if (!hasAuthSession) {
      navigateXi({ href: XI_ROUTES.login, from: "lobby", to: "lobby" });
      return;
    }
    navigateXi({ href: XI_ROUTES.forgot, from: "lobby", to: "lobby" });
  }

  return (
    <section
      className="xi-pc"
      data-testid="xi-player-center"
      data-xi-player-center="1"
      aria-label={t("lobby.me.title")}
    >
      {/* Top: identity */}
      <header className="xi-pc-hero" data-testid="xi-pc-hero">
        <button
          type="button"
          className="xi-pc-avatar"
          data-testid="xi-pc-avatar"
          aria-label={t("lobby.panel.me")}
          onClick={onOpenProfile}
          style={avatarStyle}
        />
        <div className="xi-pc-id-block">
          <button
            type="button"
            className="xi-pc-nick"
            data-testid="xi-pc-nick"
            onClick={onOpenProfile}
          >
            {nickname}
          </button>
          <span className="xi-pc-uid" data-testid="xi-pc-uid">
            UID {playerIdLabel}
          </span>
          <button
            type="button"
            className="xi-pc-vip"
            data-testid="xi-pc-vip"
            onClick={onOpenVip}
          >
            {vipLabel}
          </button>
        </div>
        {profile.status === "error" ? (
          <p className="xi-pc-hint">{t("lobby.profile.error")}</p>
        ) : null}
      </header>

      {/* Mid: wallet */}
      <div className="xi-pc-wallet" data-testid="xi-pc-wallet">
        <div className="xi-pc-wallet-head">
          <h2 className="xi-pc-section-title">{t("lobby.me.wallet")}</h2>
          <span className="xi-pc-total" data-testid="xi-pc-total">
            {t("lobby.me.total")}: {totalText}
          </span>
        </div>
        <div className="xi-pc-wallet-row">
          <div
            className={`xi-pc-coin${balance.status !== "ok" ? (balance.status === "loading" ? " is-loading" : " is-error") : ""}`}
            data-testid="xi-pc-mmk"
          >
            <span className="xi-pc-coin-code">{mmkCurrency}</span>
            <strong className="xi-pc-coin-amt">{mmkText}</strong>
          </div>
          <div
            className={`xi-pc-coin is-usdt${!usdtSupported ? " is-pending" : ""}`}
            data-testid="xi-pc-usdt"
            title={
              usdtSupported
                ? undefined
                : t("lobby.wallet.usdt.pending")
            }
          >
            <span className="xi-pc-coin-code">{t("lobby.balance.usdt")}</span>
            <strong className="xi-pc-coin-amt">{usdtText}</strong>
          </div>
        </div>
        <div className="xi-pc-shortcuts" data-testid="xi-pc-wallet-shortcuts">
          <button type="button" className="xi-pc-sc" onClick={onOpenDeposit}>
            {t("lobby.feat.recharge")}
          </button>
          <button type="button" className="xi-pc-sc" onClick={onOpenWithdraw}>
            {t("lobby.feat.withdraw")}
          </button>
          <button
            type="button"
            className="xi-pc-sc"
            data-testid="xi-pc-ledger"
            onClick={() => openSheet("ledger")}
          >
            {t("lobby.me.ledger")}
          </button>
          <button
            type="button"
            className="xi-pc-sc"
            data-testid="xi-pc-records"
            onClick={() => openSheet("records")}
          >
            {t("lobby.me.records")}
          </button>
        </div>
      </div>

      {/* Group 2: activity */}
      <div className="xi-pc-group" data-testid="xi-pc-group-activity">
        <h2 className="xi-pc-section-title">{t("lobby.me.group.activity")}</h2>
        <div className="xi-pc-list">
          <button type="button" className="xi-pc-row" onClick={onOpenActivity}>
            <span>{t("lobby.feat.activity")}</span>
            <span className="xi-pc-chev" aria-hidden />
          </button>
          <button type="button" className="xi-pc-row" onClick={onOpenCheckin}>
            <span>{t("lobby.feat.checkin")}</span>
            <span className="xi-pc-chev" aria-hidden />
          </button>
          <button
            type="button"
            className="xi-pc-row"
            data-testid="xi-pc-coupons"
            onClick={() => onOpenComingSoon("lobby.me.coupons")}
          >
            <span>{t("lobby.me.coupons")}</span>
            <span className="xi-pc-badge">{t("lobby.comingSoon")}</span>
          </button>
          <button type="button" className="xi-pc-row" onClick={onOpenRankings}>
            <span>{t("lobby.feat.rankings")}</span>
            <span className="xi-pc-chev" aria-hidden />
          </button>
        </div>
      </div>

      {/* Group 3: account / support */}
      <div className="xi-pc-group" data-testid="xi-pc-group-account">
        <h2 className="xi-pc-section-title">{t("lobby.me.group.account")}</h2>
        <div className="xi-pc-list">
          <button
            type="button"
            className="xi-pc-row"
            data-testid="xi-pc-security"
            onClick={() => openSheet("security")}
          >
            <span>{t("lobby.me.security")}</span>
            <span className="xi-pc-chev" aria-hidden />
          </button>
          <div className="xi-pc-row xi-pc-lang-row" data-testid="xi-pc-language">
            <span>{t("lobby.language")}</span>
            <div className="xi-pc-lang-toggle" role="group" aria-label={t("lobby.language")}>
              {LOBBY_LANGS.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={`xi-pc-lang-btn${lang === code ? " is-active" : ""}`}
                  data-testid={`xi-pc-lang-${code}`}
                  onClick={() => saveLobbyLang(code)}
                >
                  {LANG_LABEL[code]}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="xi-pc-row"
            data-testid="xi-pc-cs"
            onClick={() => openSheet("cs")}
          >
            <span>{t("lobby.feat.cs")}</span>
            <span className="xi-pc-badge">{t("lobby.comingSoon")}</span>
          </button>
          <button
            type="button"
            className="xi-pc-row"
            data-testid="xi-pc-help"
            onClick={() => openSheet("help")}
          >
            <span>{t("lobby.me.help")}</span>
            <span className="xi-pc-chev" aria-hidden />
          </button>
          <button
            type="button"
            className="xi-pc-row"
            data-testid="xi-pc-about"
            onClick={() => openSheet("about")}
          >
            <span>{t("lobby.me.about")}</span>
            <span className="xi-pc-chev" aria-hidden />
          </button>
        </div>
      </div>

      {/* Bottom: logout */}
      <div className="xi-pc-logout-wrap">
        {hasAuthSession ? (
          <button
            type="button"
            className="xi-pc-logout"
            data-testid="xi-pc-logout"
            onClick={onLogout}
          >
            {t("lobby.auth.logout")}
          </button>
        ) : (
          <div className="xi-pc-auth-entry" data-testid="xi-pc-auth-entry">
            <button
              type="button"
              className="xi-pc-logout is-secondary"
              onClick={() =>
                navigateXi({ href: XI_ROUTES.login, from: "lobby", to: "lobby" })
              }
            >
              {t("lobby.auth.login")}
            </button>
            <button
              type="button"
              className="xi-pc-logout"
              onClick={() =>
                navigateXi({ href: XI_ROUTES.register, from: "lobby", to: "lobby" })
              }
            >
              {t("lobby.auth.register")}
            </button>
          </div>
        )}
      </div>

      {sheet ? (
        <div
          className="xi-pc-sheet-backdrop"
          role="presentation"
          data-testid="xi-pc-sheet"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSheet();
          }}
        >
          <div className="xi-pc-sheet" role="dialog" aria-modal="true">
            {sheet === "ledger" && (
              <>
                <h2>{t("lobby.me.ledger")}</h2>
                <WalletPanel t={t} />
              </>
            )}
            {sheet === "records" && (
              <>
                <h2>{t("lobby.me.records")}</h2>
                <RecordsPanel t={t} />
              </>
            )}
            {sheet === "security" && (
              <>
                <h2>{t("lobby.me.security")}</h2>
                <p className="xi-pc-sheet-hint">{t("lobby.me.security.hint")}</p>
                <div className="xi-pc-list">
                  <button
                    type="button"
                    className="xi-pc-row"
                    data-testid="xi-pc-change-password"
                    onClick={onChangePassword}
                  >
                    <span>{t("lobby.me.security.password")}</span>
                    <span className="xi-pc-chev" aria-hidden />
                  </button>
                  {(
                    [
                      ["devices", "lobby.me.security.devices"],
                      ["loginHistory", "lobby.me.security.loginHistory"],
                      ["phone", "lobby.me.security.phone"],
                      ["email", "lobby.me.security.email"],
                      ["kyc", "lobby.me.security.kyc"],
                      ["otp", "lobby.me.security.otp"],
                    ] as const
                  ).map(([id, key]) => (
                    <div
                      key={id}
                      className="xi-pc-row is-reserved"
                      data-testid={`xi-pc-security-${id}`}
                    >
                      <span>{t(key)}</span>
                      <span className="xi-pc-badge">{t("lobby.me.reserved")}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {sheet === "cs" && (
              <>
                <h2>{t("lobby.feat.cs")}</h2>
                <p className="xi-pc-sheet-hint">{t("lobby.me.cs.body")}</p>
                <p className="xi-pc-badge-inline">{t("lobby.comingSoon")}</p>
              </>
            )}
            {sheet === "help" && (
              <>
                <h2>{t("lobby.me.help")}</h2>
                <p className="xi-pc-sheet-hint">{t("lobby.me.help.body")}</p>
              </>
            )}
            {sheet === "about" && (
              <>
                <h2>{t("lobby.me.about")}</h2>
                <p className="xi-pc-sheet-hint">{t("lobby.me.about.body")}</p>
                <p className="xi-pc-sheet-hint">{t("lobby.brand")}</p>
              </>
            )}
            <div className="xi-pc-sheet-actions">
              <button type="button" className="xi-pc-sc" onClick={closeSheet}>
                {t("lobby.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

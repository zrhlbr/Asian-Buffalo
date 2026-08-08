"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { LobbyCatalogResponse, LobbyGameCard } from "../../lib/lobby-catalog.ts";
import {
  clearLobbyCaches,
  fetchAnnouncements,
  fetchBalance,
  fetchLobbyCatalog,
  fetchProfile,
  formatMinor,
  peekCachedBalance,
  peekCachedProfile,
  type LoadState,
  type LobbyBalanceView,
  type LobbyProfileView,
} from "./api.ts";
import { authLogout } from "./auth-api.ts";
import {
  ActivityPanel,
  CheckinPanel,
  DepositPanel,
  RankingsPanel,
  VipCenterPanel,
  WithdrawPanel,
} from "./commerce-panels.tsx";
import {
  LOBBY_LANGS,
  getLobbyLangServerSnapshot,
  loadLobbyLang,
  saveLobbyLang,
  subscribeLobbyLang,
  tLobby,
  type LobbyLang,
} from "./i18n.ts";
import { consumeEnterTransition, navigateXi, XI_ROUTES } from "./nav.ts";
import {
  heroAvifSrcSet,
  heroSizes,
  heroSources,
  heroSrcSet,
  particleCountForTier,
  resolveTier,
} from "./quality.ts";
import { PlayerCenter } from "./player-center.tsx";
import { ProgressiveHeroImage, QualitySettingsPanel } from "./quality-panel.tsx";
import { WalletCenter } from "./wallet-center.tsx";
import {
  getXiHydratedServerSnapshot,
  getXiHydratedSnapshot,
  getXiQualityServerSnapshot,
  getXiQualitySnapshot,
  setXiQualitySettings,
  subscribeXiHydrated,
  subscribeXiQuality,
} from "./ui-store.ts";
import "./lobby.css";

type NavId = "home" | "games" | "wallet" | "activity" | "me";
type ModalKind =
  | null
  | "pending"
  | "announcements"
  | "messages"
  | "settings"
  | "coming_soon"
  | "vip"
  | "profile"
  | "deposit"
  | "withdraw"
  | "checkin"
  | "activity"
  | "rankings";

type FeatureId =
  | "recharge"
  | "withdraw"
  | "activity"
  | "vip"
  | "rankings"
  | "announcements"
  | "cs";

/** Reference order: 充值/提现/活动中心/VIP中心/排行榜/公告/客服 */
const QUICK_FEATURES: FeatureId[] = [
  "recharge",
  "withdraw",
  "activity",
  "vip",
  "rankings",
  "announcements",
  "cs",
];

/** Always-visible lang labels (reference: 中文 / မြန်မာ / EN). */
const LANG_TOGGLE_ORDER: LobbyLang[] = ["zh-CN", "my-MM", "en"];
const LANG_LABEL: Record<LobbyLang, string> = {
  "zh-CN": "中文",
  "my-MM": "မြန်မာ",
  en: "EN",
};

type RecGame = {
  id: string;
  titleKey: string;
  status: "live" | "coming_soon";
  href?: string;
  hot?: boolean;
  art: "bdk" | "dragon" | "phoenix" | "wealth" | "panda";
  /** Only set when a real jackpot feed exists — never fake. */
  jackpotDisplay?: string | null;
  /** Eager first card; others lazy. */
  imageSrc?: string;
};

/** Zhao reference recommended row — presentation only (no catalog API change). */
const RECOMMENDED_GAMES: RecGame[] = [
  {
    id: "bdk",
    titleKey: "lobby.games.bdk.title",
    status: "live",
    href: "/xi/bull-demon-king",
    hot: true,
    art: "bdk",
    jackpotDisplay: null,
    imageSrc: "/xi/heroes/bdk-mobile.webp",
  },
  {
    id: "dragonking",
    titleKey: "lobby.games.dragonking.title",
    status: "coming_soon",
    art: "dragon",
    jackpotDisplay: null,
  },
  {
    id: "phoenix",
    titleKey: "lobby.games.phoenix.title",
    status: "coming_soon",
    art: "phoenix",
    jackpotDisplay: null,
  },
  {
    id: "caishen",
    titleKey: "lobby.games.caishen.title",
    status: "coming_soon",
    art: "wealth",
    jackpotDisplay: null,
  },
  {
    id: "wulinpanda",
    titleKey: "lobby.games.wulinpanda.title",
    status: "coming_soon",
    art: "panda",
    jackpotDisplay: null,
  },
];

type FeatMotif = "chest" | "pouch" | "gift" | "crown" | "trophy" | "scroll" | "headset";

function featMotif(id: FeatureId): FeatMotif {
  switch (id) {
    case "recharge":
      return "chest";
    case "withdraw":
      return "pouch";
    case "activity":
      return "gift";
    case "vip":
      return "crown";
    case "rankings":
      return "trophy";
    case "announcements":
      return "scroll";
    case "cs":
      return "headset";
  }
}

function filterGames(games: LobbyGameCard[], cat: string): LobbyGameCard[] {
  if (cat === "recommended") {
    return games.filter(
      (g) => g.badges.includes("recommended") || g.category === "recommended",
    );
  }
  if (cat === "hot") return games.filter((g) => g.badges.includes("hot"));
  if (cat === "new") return games.filter((g) => g.badges.includes("new"));
  if (cat === "jackpot") {
    return games.filter(
      (g) => g.badges.includes("jackpot") || g.category === "jackpot",
    );
  }
  if (cat === "slots") {
    return games.filter((g) => g.category === "slots" || g.id === "bdk");
  }
  return games;
}

function shortPlayerId(raw: string | null | undefined): string {
  if (!raw) return "————";
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 6) return digits.slice(-6);
  if (raw.length >= 6) return raw.slice(-6);
  return raw;
}

export default function LobbyApp() {
  const lang = useSyncExternalStore(
    subscribeLobbyLang,
    loadLobbyLang,
    getLobbyLangServerSnapshot,
  );
  const [nav, setNav] = useState<NavId>("home");
  const [cat, setCat] = useState("recommended");
  const [modal, setModal] = useState<ModalKind>(null);
  const [pendingKey, setPendingKey] = useState("lobby.pending.title");
  const [comingTitleKey, setComingTitleKey] = useState("lobby.comingSoon");
  const [catalog, setCatalog] = useState<LoadState<LobbyCatalogResponse>>({
    status: "loading",
  });
  const [profile, setProfile] = useState<
    LoadState<{
      nickname: string;
      vipLevel: number | null;
      avatarUrl: string | null;
      playerId: string | null;
    }>
  >({ status: "loading" });
  const [balance, setBalance] = useState<
    LoadState<{ currency: string; balanceMinor: number }>
  >({ status: "loading" });
  /** Formal Auth session (cookie) — independent of DevTest identity profile. */
  const [hasAuthSession, setHasAuthSession] = useState(false);
  const [announcements, setAnnouncements] = useState<
    LoadState<Array<{ id: string; title: string; body: string }>>
  >({ status: "loading" });
  const [announceLang, setAnnounceLang] = useState<LobbyLang>(lang);
  const qualitySettings = useSyncExternalStore(
    subscribeXiQuality,
    getXiQualitySnapshot,
    getXiQualityServerSnapshot,
  );
  const qualityHydrated = useSyncExternalStore(
    subscribeXiHydrated,
    getXiHydratedSnapshot,
    getXiHydratedServerSnapshot,
  );

  const rootRef = useRef<HTMLDivElement | null>(null);
  const t = (key: string) => tLobby(lang, key);

  useEffect(() => {
    consumeEnterTransition(rootRef.current);
  }, []);

  const announcementsView: LoadState<Array<{ id: string; title: string; body: string }>> =
    announceLang !== lang ? { status: "loading" } : announcements;
  // Particles only after hydrate — SSR + first client paint share empty set.
  const qualityTier = qualityHydrated
    ? resolveTier(qualitySettings.mode)
    : ("medium" as const);
  const particleN = qualityHydrated
    ? particleCountForTier(qualityTier, qualitySettings.fxEnabled)
    : 0;

  useEffect(() => {
    document.title = tLobby(lang, "lobby.page.xi");
  }, [lang]);

  useEffect(() => {
    // Post-hydrate shell cache only — never in useState init (SSR mismatch).
    const cachedProfile = peekCachedProfile();
    const cachedBalance = peekCachedBalance();
    if (cachedProfile) setProfile({ status: "ok", data: cachedProfile });
    if (cachedBalance) setBalance({ status: "ok", data: cachedBalance });

    let cancelled = false;
    void (async () => {
      const [c, p, b] = await Promise.all([
        fetchLobbyCatalog(),
        fetchProfile(),
        fetchBalance(),
      ]);
      if (cancelled) return;
      if (c.status === "ok") {
        setCatalog({ status: "ok", data: c.data as unknown as LobbyCatalogResponse });
      } else {
        setCatalog(c);
      }
      setProfile(p);
      setBalance(b);
    })();

    const onAuthHydrated = (ev: Event) => {
      const detail = (ev as CustomEvent<{ profile: LobbyProfileView; wallet: LobbyBalanceView }>)
        .detail;
      if (!detail?.profile || !detail?.wallet) return;
      setHasAuthSession(true);
      setProfile({ status: "ok", data: detail.profile });
      setBalance({ status: "ok", data: detail.wallet });
    };
    window.addEventListener("xi-auth-hydrated", onAuthHydrated);

    void fetch("/api/v1/auth/me", { credentials: "same-origin" })
      .then((res) => {
        if (!cancelled) setHasAuthSession(res.ok);
      })
      .catch(() => {
        if (!cancelled) setHasAuthSession(false);
      });

    return () => {
      cancelled = true;
      window.removeEventListener("xi-auth-hydrated", onAuthHydrated);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requested = lang;
    void fetchAnnouncements(requested).then((a) => {
      if (cancelled) return;
      setAnnouncements(a);
      setAnnounceLang(requested);
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const games = useMemo(() => {
    if (catalog.status !== "ok") return [];
    return filterGames(catalog.data.games, cat);
  }, [catalog, cat]);

  const tickerText = useMemo(() => {
    if (announcementsView.status === "loading") {
      return t("lobby.loading");
    }
    if (announcementsView.status === "error") {
      return t("lobby.announcements.error");
    }
    if (announcementsView.status === "ok" && announcementsView.data.length > 0) {
      return announcementsView.data
        .map((a) => a.title || a.body)
        .filter(Boolean)
        .join("   ·   ");
    }
    return t("lobby.ticker.empty");
  }, [announcementsView, lang]);

  const tickerIsMarquee =
    announcementsView.status === "ok" && announcementsView.data.length > 0;

  function refreshBalance() {
    void fetchBalance().then(setBalance);
  }

  function openPending(feature: FeatureId | "checkin") {
    if (feature === "announcements") {
      setModal("announcements");
      return;
    }
    if (feature === "vip") {
      setModal("vip");
      return;
    }
    if (feature === "recharge") {
      setModal("deposit");
      return;
    }
    if (feature === "withdraw") {
      setModal("withdraw");
      return;
    }
    if (feature === "checkin") {
      setModal("checkin");
      return;
    }
    if (feature === "activity") {
      setNav("activity");
      setModal("activity");
      return;
    }
    if (feature === "rankings") {
      setModal("rankings");
      return;
    }
    if (feature === "cs") {
      setComingTitleKey("lobby.feat.cs");
      setModal("coming_soon");
      return;
    }
    setPendingKey(`lobby.feat.${feature}`);
    setModal("pending");
  }

  function goLiveHref(href: string) {
    const toHub =
      href === XI_ROUTES.hub ||
      href.startsWith("/xi/bull-demon-king") ||
      href === "/xi/bdk";
    if (toHub) {
      navigateXi({ href: XI_ROUTES.hub, from: "lobby", to: "hub", ms: 220 });
      return;
    }
    navigateXi({ href, from: "lobby", to: "lobby", ms: 200 });
  }

  function onRecGameClick(game: RecGame) {
    if (game.status === "live" && game.href) {
      goLiveHref(game.href);
      return;
    }
    setComingTitleKey(game.titleKey);
    setModal("coming_soon");
  }

  function onGameClick(game: LobbyGameCard) {
    if (game.status === "live" && game.href) {
      goLiveHref(game.href);
      return;
    }
    setComingTitleKey(game.titleKey);
    setModal("coming_soon");
  }

  function switchLang(next: LobbyLang) {
    saveLobbyLang(next);
  }

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

  const mmkText =
    balance.status === "loading"
      ? t("lobby.loading")
      : balance.status === "error"
        ? t("lobby.wallet.error")
        : `${formatMinor(balance.data.balanceMinor, balance.data.currency)}`;

  const mmkCurrency =
    balance.status === "ok" ? balance.data.currency : t("lobby.balance.mmk");

  const onLogout = () => {
    void (async () => {
      await authLogout();
      clearLobbyCaches();
      setHasAuthSession(false);
      // Soft refresh profile/balance for DevTest fallback (if gated).
      const [p, b] = await Promise.all([fetchProfile(), fetchBalance()]);
      setProfile(p);
      setBalance(b);
    })();
  };

  return (
    <div
      ref={rootRef}
      className="xi-lobby-root xi-mythic-lobby xi-layout-v2 xi-lobby-v3"
      data-testid="xi-lobby-root"
      lang={lang}
      data-lang={lang}
      data-xi-lobby-tier={qualityHydrated ? qualityTier : "medium"}
      data-xi-lobby-v3="1"
    >
      <header className="xi-topbar xi-jade-tablet xi-topbar-v2" data-testid="xi-topbar">
        <div className="xi-tablet-cloud" aria-hidden />
        <div className="xi-top-left">
          <button
            type="button"
            className="xi-avatar"
            aria-label={t("lobby.panel.me")}
            onClick={() => setModal("profile")}
            style={
              profile.status === "ok" && profile.data.avatarUrl
                ? {
                    backgroundImage: `url(${profile.data.avatarUrl})`,
                    backgroundSize: "cover",
                  }
                : undefined
            }
          />
          <div className="xi-user-meta">
            <span className="xi-nickname">{nickname}</span>
            <span className="xi-user-id" data-testid="xi-player-id">
              ID: {playerIdLabel}
            </span>
            <span className="xi-vip-pill xi-vip-breath" data-testid="xi-vip-pill">
              {vipLabel}
            </span>
          </div>
        </div>

        <div className="xi-top-center">
          <div
            className={`xi-wallet-chip xi-wallet-breath${balance.status !== "ok" ? (balance.status === "loading" ? " is-loading" : " is-error") : ""}`}
            data-testid="xi-wallet-mmk"
          >
            <span className="xi-wallet-ico xi-wallet-ico-mmk" aria-hidden />
            <span className="xi-wallet-meta">
              <span className="xi-wallet-code">{mmkCurrency}</span>
              <strong className="xi-wallet-amount">{mmkText}</strong>
            </span>
            <button
              type="button"
              className="xi-wallet-plus"
              aria-label={t("lobby.feat.recharge")}
              onClick={() => openPending("recharge")}
            >
              +
            </button>
          </div>
          <div
            className="xi-wallet-chip is-usdt is-loading"
            title={t("lobby.wallet.usdt.pending")}
            data-testid="xi-wallet-usdt"
          >
            <span className="xi-wallet-ico xi-wallet-ico-usdt" aria-hidden />
            <span className="xi-wallet-meta">
              <span className="xi-wallet-code">{t("lobby.balance.usdt")}</span>
              <strong>{t("lobby.unavailable")}</strong>
            </span>
            <button
              type="button"
              className="xi-wallet-plus"
              aria-label={t("lobby.feat.recharge")}
              onClick={() => openPending("recharge")}
            >
              +
            </button>
          </div>
        </div>

        <div className="xi-top-right">
          {!hasAuthSession ? (
            <div className="xi-auth-entry" data-testid="xi-auth-entry">
              <button
                type="button"
                className="xi-auth-entry-btn"
                onClick={() => navigateXi({ href: XI_ROUTES.login, from: "lobby", to: "lobby" })}
              >
                {t("lobby.auth.login")}
              </button>
              <button
                type="button"
                className="xi-auth-entry-btn is-primary"
                onClick={() =>
                  navigateXi({ href: XI_ROUTES.register, from: "lobby", to: "lobby" })
                }
              >
                {t("lobby.auth.register")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="xi-auth-entry-btn"
              data-testid="xi-auth-logout"
              onClick={onLogout}
            >
              {t("lobby.auth.logout")}
            </button>
          )}
          <button
            type="button"
            className="xi-icon-btn xi-icon-msg"
            onClick={() => setModal("messages")}
            aria-label={t("lobby.messages")}
          >
            <span className="xi-ico-envelope" aria-hidden />
            <span className="xi-icon-label">{t("lobby.messages")}</span>
          </button>
          <button
            type="button"
            className="xi-icon-btn xi-icon-settings"
            onClick={() => setModal("settings")}
            aria-label={t("lobby.settings")}
          >
            <span className="xi-ico-gear" aria-hidden />
            <span className="xi-icon-label">{t("lobby.settings")}</span>
          </button>
          <div className="xi-lang-direct" data-testid="xi-lang-direct" role="group" aria-label={t("lobby.language")}>
            {LANG_TOGGLE_ORDER.map((code) => (
              <button
                key={code}
                type="button"
                className={`xi-lang-direct-btn${lang === code ? " is-active" : ""}`}
                data-testid={`xi-lang-${code}`}
                onClick={() => switchLang(code)}
              >
                {LANG_LABEL[code]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {(nav === "home" || nav === "games") && (
        <>
          <section
            className="xi-hero xi-hero-mythic xi-hero-photo"
            data-testid="xi-lobby-hero"
            aria-label={t("lobby.hero.journey")}
          >
            <ProgressiveHeroImage
              kind="journey"
              className="xi-hero-img"
              alt={t("lobby.hero.journey")}
              testId="xi-hero-img"
              sources={heroSources("journey")}
              srcSet={heroSrcSet("journey")}
              avifSrcSet={heroAvifSrcSet("journey")}
              sizes={heroSizes()}
            />
            <div className="xi-hero-sky" aria-hidden />
            <div className="xi-hero-sun xi-hero-sun-breath" aria-hidden />
            <div className="xi-hero-rays" aria-hidden />
            <div className="xi-hero-clouds" aria-hidden />
            <div className="xi-hero-mist" aria-hidden />
            {/* Spirit dots — HIGH/ULTRA only via particleN; no canvas/blur spam */}
            <div className="xi-hero-particles xi-hero-spirit-dots" aria-hidden>
              {Array.from({ length: particleN }, (_, i) => (
                <span key={i} />
              ))}
            </div>
            <div className="xi-hero-copy xi-hero-copy-overlay">
              <div className="xi-hero-brand" data-testid="xi-lobby-brand">
                {t("lobby.brand")}
              </div>
              <div className="xi-hero-journey">{t("lobby.hero.journey")}</div>
            </div>
          </section>

          <section
            className={`xi-ticker${tickerIsMarquee ? "" : " is-static"}`}
            data-testid="xi-ticker"
            aria-label={t("lobby.announcements")}
          >
            <span className="xi-ticker-speaker" aria-hidden />
            <div className="xi-ticker-track">
              {tickerIsMarquee ? (
                <div className="xi-ticker-scroll" key={`${lang}-${tickerText.slice(0, 24)}`}>
                  <span>{tickerText}</span>
                  <span aria-hidden>{tickerText}</span>
                </div>
              ) : (
                <div className="xi-ticker-static" data-testid="xi-ticker-empty">
                  {tickerText}
                </div>
              )}
            </div>
            <button
              type="button"
              className="xi-ticker-more"
              onClick={() => setModal("announcements")}
            >
              {t("lobby.ticker.more")}
            </button>
          </section>
        </>
      )}

      <main className="xi-main">
        {nav === "home" && (
          <>
            <section className="xi-rec-section" data-testid="xi-recommended">
              <div className="xi-section-head">
                <h2 className="xi-section-title">{t("lobby.section.recommended")}</h2>
                <button
                  type="button"
                  className="xi-section-more"
                  onClick={() => setNav("games")}
                >
                  {t("lobby.section.moreGames")}
                </button>
              </div>
              <div className="xi-ornament" aria-hidden />
              <div className="xi-rec-row">
                {RECOMMENDED_GAMES.map((game, index) => (
                  <button
                    key={game.id}
                    type="button"
                    className={`xi-rec-card art-${game.art}${game.hot ? " is-hot" : ""}${game.status === "coming_soon" ? " is-soon" : ""}`}
                    data-id={game.id}
                    data-testid={game.id === "bdk" ? "xi-card-bdk" : `xi-card-${game.id}`}
                    data-href={game.href ?? ""}
                    onClick={() => onRecGameClick(game)}
                  >
                    {game.hot ? (
                      <span className="xi-rec-hot">{t("lobby.badge.hot")}</span>
                    ) : null}
                    {game.status === "coming_soon" ? (
                      <span className="xi-rec-soon">{t("lobby.rec.soon")}</span>
                    ) : null}
                    <span className="xi-rec-art" aria-hidden>
                      {game.imageSrc ? (
                        <img
                          className="xi-rec-art-img"
                          src={game.imageSrc}
                          alt=""
                          decoding="async"
                          loading={index === 0 ? "eager" : "lazy"}
                          fetchPriority={index === 0 ? "high" : "low"}
                        />
                      ) : null}
                    </span>
                    <span className="xi-rec-title">{t(game.titleKey)}</span>
                    {game.jackpotDisplay ? (
                      <span className="xi-rec-jackpot">
                        {t("lobby.badge.jackpot")} {game.jackpotDisplay}
                      </span>
                    ) : game.status === "coming_soon" ? (
                      <span className="xi-rec-meta">{t("lobby.comingSoon")}</span>
                    ) : (
                      <span className="xi-rec-meta">{t("lobby.games.bdk.subtitle")}</span>
                    )}
                  </button>
                ))}
              </div>
            </section>

            <section className="xi-quick-section" data-testid="xi-quick-features">
              <h2 className="xi-section-title">{t("lobby.section.quick")}</h2>
              <div className="xi-ornament" aria-hidden />
              <div className="xi-quick-row">
                {QUICK_FEATURES.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="xi-feat-btn xi-quick-btn"
                    data-motif={featMotif(id)}
                    data-testid={`xi-feat-${id}`}
                    onClick={() => openPending(id)}
                  >
                    <span className={`xi-feat-ico motif-${featMotif(id)}`} aria-hidden />
                    {id === "activity" ? <span className="xi-feat-dot" aria-hidden /> : null}
                    <span className="xi-quick-label">{t(`lobby.feat.${id}`)}</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {nav === "games" && (
          <CatalogBlock
            t={t}
            catalog={catalog}
            cat={cat}
            setCat={setCat}
            games={games}
            onGameClick={onGameClick}
          />
        )}

        {nav === "wallet" && (
          <WalletCenter
            t={t}
            lang={lang}
            balance={balance}
            onBalanceRefresh={refreshBalance}
          />
        )}

        {nav === "activity" && (
          <section className="xi-panel-card">
            <h2 className="xi-section-title">{t("lobby.panel.activity")}</h2>
            <ActivityPanel t={t} lang={lang} onBalanceRefresh={refreshBalance} />
            <div className="xi-activity-checkin-entry">
              <button
                type="button"
                className="xi-primary"
                data-testid="xi-nav-activity-open-checkin"
                onClick={() => openPending("checkin")}
              >
                {t("lobby.feat.checkin")}
              </button>
            </div>
          </section>
        )}

        {nav === "me" && (
          <PlayerCenter
            t={t}
            lang={lang}
            profile={profile}
            balance={balance}
            hasAuthSession={hasAuthSession}
            onOpenProfile={() => setModal("profile")}
            onOpenVip={() => setModal("vip")}
            onOpenDeposit={() => openPending("recharge")}
            onOpenWithdraw={() => openPending("withdraw")}
            onOpenActivity={() => openPending("activity")}
            onOpenCheckin={() => openPending("checkin")}
            onOpenRankings={() => openPending("rankings")}
            onOpenComingSoon={(titleKey) => {
              setComingTitleKey(titleKey);
              setModal("coming_soon");
            }}
            onLogout={onLogout}
          />
        )}
      </main>

      <nav className="xi-bottom-nav xi-bottom-nav-v2" aria-label="XI GAME" data-testid="xi-bottom-nav">
        {(
          [
            ["home", "lobby.nav.home", "temple"],
            ["games", "lobby.nav.games", "pad"],
            ["wallet", "lobby.nav.wallet", "bag"],
            ["activity", "lobby.nav.activity", "gift"],
            ["me", "lobby.nav.me", "user"],
          ] as const
        ).map(([id, key, icon]) => (
          <button
            key={id}
            type="button"
            className={`xi-nav-btn${nav === id ? " is-active" : ""}`}
            data-testid={`xi-nav-${id}`}
            data-icon={icon}
            onClick={() => setNav(id)}
          >
            <span className={`xi-nav-ico ico-${icon}`} aria-hidden />
            {id === "activity" ? <span className="xi-nav-dot-badge" aria-hidden /> : null}
            <span>{t(key)}</span>
          </button>
        ))}
      </nav>

      {modal && (
        <div
          className="xi-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="xi-modal" role="dialog" aria-modal="true">
            {modal === "pending" && (
              <>
                <h2>{t(pendingKey)}</h2>
                <p>{t("lobby.pending.title")}</p>
                <p>{t("lobby.pending.body")}</p>
              </>
            )}
            {modal === "coming_soon" && (
              <div className="xi-coming-soon-toast" data-testid="xi-coming-soon-modal">
                <h2>{t(comingTitleKey)}</h2>
                <p className="xi-coming-soon-badge">{t("lobby.comingSoon")}</p>
                <p>{t("lobby.comingSoon.body")}</p>
              </div>
            )}
            {modal === "vip" && (
              <>
                <h2>{t("lobby.feat.vip")}</h2>
                <VipCenterPanel t={t} lang={lang} />
              </>
            )}
            {modal === "deposit" && (
              <>
                <h2>{t("lobby.feat.recharge")}</h2>
                <DepositPanel t={t} lang={lang} onBalanceRefresh={refreshBalance} />
              </>
            )}
            {modal === "withdraw" && (
              <>
                <h2>{t("lobby.feat.withdraw")}</h2>
                <WithdrawPanel t={t} lang={lang} onBalanceRefresh={refreshBalance} />
              </>
            )}
            {modal === "activity" && (
              <>
                <h2>{t("lobby.feat.activity")}</h2>
                <ActivityPanel t={t} lang={lang} onBalanceRefresh={refreshBalance} />
                <div className="xi-activity-checkin-entry">
                  <button
                    type="button"
                    className="xi-primary"
                    data-testid="xi-activity-open-checkin"
                    onClick={() => openPending("checkin")}
                  >
                    {t("lobby.feat.checkin")}
                  </button>
                </div>
              </>
            )}
            {modal === "checkin" && (
              <>
                <h2>{t("lobby.feat.checkin")}</h2>
                <CheckinPanel t={t} onBalanceRefresh={refreshBalance} />
              </>
            )}
            {modal === "rankings" && (
              <>
                <h2>{t("lobby.feat.rankings")}</h2>
                <RankingsPanel t={t} />
              </>
            )}
            {modal === "profile" && (
              <>
                <h2>{t("lobby.panel.me")}</h2>
                <p>
                  {t("lobby.nickname")}: {nickname}
                </p>
                <p>ID: {playerIdLabel}</p>
                <p>{vipLabel}</p>
                {profile.status === "error" && <p>{t("lobby.profile.error")}</p>}
              </>
            )}
            {modal === "messages" && (
              <>
                <h2>{t("lobby.messages")}</h2>
                <p>{t("lobby.messages.empty")}</p>
              </>
            )}
            {modal === "announcements" && (
              <>
                <h2>{t("lobby.announcements")}</h2>
                {announcementsView.status === "loading" && <p>{t("lobby.loading")}</p>}
                {announcementsView.status === "error" && (
                  <p>{t("lobby.announcements.error")}</p>
                )}
                {announcementsView.status === "ok" &&
                  announcementsView.data.length === 0 && (
                  <p>{t("lobby.announcements.empty")}</p>
                )}
                {announcementsView.status === "ok" &&
                  announcementsView.data.length > 0 && (
                  <ul className="xi-announce-list">
                    {announcementsView.data.map((item) => (
                      <li key={item.id}>
                        <strong>{item.title || t("lobby.announcements")}</strong>
                        {item.body ? <div>{item.body}</div> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {modal === "settings" && (
              <>
                <h2>{t("lobby.settings")}</h2>
                <p>{t("lobby.settings.body")}</p>
                <QualitySettingsPanel
                  t={t}
                  settings={qualitySettings}
                  onChange={setXiQualitySettings}
                  testIdPrefix="xi-lobby-quality"
                />
                <div className="xi-lang-row">
                  {LOBBY_LANGS.map((code) => (
                    <button
                      key={code}
                      type="button"
                      className={`xi-icon-btn${lang === code ? " is-active" : ""}`}
                      onClick={() => switchLang(code)}
                    >
                      {LANG_LABEL[code]}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="xi-modal-actions">
              <button
                type="button"
                className="xi-secondary"
                onClick={() => setModal(null)}
              >
                {t("lobby.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CatalogBlock({
  t,
  catalog,
  cat,
  setCat,
  games,
  onGameClick,
}: {
  t: (key: string) => string;
  catalog: LoadState<LobbyCatalogResponse>;
  cat: string;
  setCat: (id: string) => void;
  games: LobbyGameCard[];
  onGameClick: (game: LobbyGameCard) => void;
}) {
  return (
    <section>
      <h2 className="xi-section-title">{t("lobby.section.catalog")}</h2>
      {catalog.status === "loading" && (
        <p className="xi-status-line">{t("lobby.loading")}</p>
      )}
      {catalog.status === "error" && (
        <p className="xi-status-line">{t("lobby.error")}</p>
      )}
      {catalog.status === "ok" && (
        <>
          <div className="xi-cats">
            {catalog.data.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`xi-cat-chip${cat === c.id ? " is-active" : ""}`}
                onClick={() => setCat(c.id)}
              >
                {t(c.labelKey)}
              </button>
            ))}
          </div>
          <div className="xi-game-grid" style={{ marginTop: "0.65rem" }}>
            {games.map((game) => (
              <button
                key={game.id}
                type="button"
                className={`xi-game-card${game.status === "coming_soon" ? " is-soon" : ""}`}
                data-id={game.id}
                data-testid={game.id === "bdk" ? "xi-card-bdk" : `xi-card-${game.id}`}
                data-href={game.href ?? ""}
                onClick={() => onGameClick(game)}
              >
                <span className="xi-game-art" aria-hidden />
                <div className="xi-badges">
                  {game.badges.map((b) => (
                    <span key={b} className={`xi-badge ${b}`}>
                      {t(`lobby.badge.${b}`)}
                    </span>
                  ))}
                  {game.status === "coming_soon" && (
                    <span className="xi-badge new">{t("lobby.comingSoon")}</span>
                  )}
                </div>
                <div className="xi-game-title">{t(game.titleKey)}</div>
                <div className="xi-game-meta">
                  {game.id === "bdk" && <span>{t("lobby.games.bdk.subtitle")}</span>}
                  {game.multiplierLabel && <span>{game.multiplierLabel}</span>}
                  <span>
                    {t("lobby.players")}:{" "}
                    {game.playersOnline == null
                      ? t("lobby.players.unknown")
                      : game.playersOnline}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

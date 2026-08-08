"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  fetchAnnouncements,
  fetchBalance,
  fetchProfile,
  fetchVip,
  formatMinor,
  type LoadState,
} from "./api.ts";
import {
  ActivityPanel,
  CheckinPanel,
  DepositPanel,
  RankingsPanel,
  RecordsPanel,
  VipCenterPanel,
  WalletPanel,
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
import {
  markXiPerf,
  prefetchPlayCoreAssets,
  warmGameClient,
} from "./game-lifecycle.ts";
import {
  attachEdgeSwipe,
  attachEscNav,
  consumeEnterTransition,
  getOptimisticXiLayer,
  isXiModalOpen,
  navigateXi,
  resolveEffectiveXiLayer,
  subscribeOptimisticXiLayer,
  XI_ROUTES,
} from "./nav.ts";
import {
  activeTierFromSettings,
  heroAvifSrcSet,
  heroSizes,
  heroSources,
  heroSrcSet,
  prefetchHubHero,
  prefetchPlayCoreByTier,
  prefetchSlotAssets,
  resolveTier,
} from "./quality.ts";
import { ProgressiveHeroImage, QualitySettingsPanel } from "./quality-panel.tsx";
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

type ModalKind =
  | null
  | "pending"
  | "coming_soon"
  | "announcements"
  | "messages"
  | "settings"
  | "vip"
  | "profile"
  | "rules"
  | "paytable"
  | "betHelp"
  | "rankings"
  | "records"
  | "deposit"
  | "withdraw"
  | "activity"
  | "checkin"
  | "wallet";

type FeatId =
  | "recharge"
  | "withdraw"
  | "vip"
  | "activity"
  | "checkin"
  | "rules"
  | "paytable"
  | "betHelp"
  | "rankings"
  | "records"
  | "profile"
  | "announce"
  | "cs"
  | "help"
  | "settings";

type FeatGroup = {
  id: "funds" | "member" | "game" | "player" | "service";
  titleKey: string;
  items: FeatId[];
};

const FEAT_GROUPS: FeatGroup[] = [
  { id: "funds", titleKey: "lobby.bdk.group.funds", items: ["recharge", "withdraw"] },
  { id: "member", titleKey: "lobby.bdk.group.member", items: ["vip", "activity", "checkin"] },
  {
    id: "game",
    titleKey: "lobby.bdk.group.game",
    items: ["rules", "paytable", "betHelp", "rankings", "records"],
  },
  { id: "player", titleKey: "lobby.bdk.group.player", items: ["profile"] },
  {
    id: "service",
    titleKey: "lobby.bdk.group.service",
    items: ["announce", "cs", "help", "settings"],
  },
];

/**
 * Step 2 — 《西游戏之牛魔王》 hub.
 * Slot reel/HUD redesign is Step 3 — not in this module.
 */
export default function BdkHub() {
  const pathname = usePathname();
  const optimistic = useSyncExternalStore(
    subscribeOptimisticXiLayer,
    getOptimisticXiLayer,
    () => null,
  );
  const lang = useSyncExternalStore(
    subscribeLobbyLang,
    loadLobbyLang,
    getLobbyLangServerSnapshot,
  );
  const [modal, setModal] = useState<ModalKind>(null);
  const [pendingKey, setPendingKey] = useState("lobby.pending.title");
  const [starting, setStarting] = useState(false);
  const [pressing, setPressing] = useState(false);
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
  const [vip, setVip] = useState<
    LoadState<{ level: number | null; status: string | null }>
  >({ status: "loading" });
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

  const t = (key: string) => tLobby(lang, key);
  const announcementsView =
    announceLang !== lang ? ({ status: "loading" } as const) : announcements;

  function refreshBalance() {
    void fetchBalance().then(setBalance);
    void fetchVip().then(setVip);
  }

  const rootRef = useRef<HTMLDivElement | null>(null);

  const goLobby = useCallback(() => {
    navigateXi({ href: XI_ROUTES.lobby, from: "hub", to: "lobby", ms: 240 });
  }, []);

  useEffect(() => {
    document.title = tLobby(lang, "lobby.page.bdkHub");
  }, [lang]);

  // Keep-alive may preserve Hub across Play — clear Start CTA lock on return
  useEffect(() => {
    if (resolveEffectiveXiLayer(pathname) === "hub") {
      setStarting(false);
      setPressing(false);
    }
  }, [pathname, optimistic]);

  useEffect(() => {
    consumeEnterTransition(rootRef.current);
  }, []);

  useEffect(() => {
    prefetchHubHero();
  }, []);

  // Hub idle: prefetch play chunk + core symbols (no Session/Spin/Round)
  useEffect(() => {
    if (!qualityHydrated) return;
    const tier = activeTierFromSettings(qualitySettings);
    const idle = window.setTimeout(() => {
      void prefetchPlayCoreAssets(() => prefetchPlayCoreByTier(tier));
    }, 480);
    return () => window.clearTimeout(idle);
  }, [qualityHydrated, qualitySettings]);

  const warmPlay = useCallback(() => {
    if (!qualityHydrated) return;
    const tier = activeTierFromSettings(qualitySettings);
    void prefetchPlayCoreAssets(() => prefetchPlayCoreByTier(tier));
    // Gesture-safe: warm WebGL with deferred session bootstrap
    warmGameClient({ deferBootstrap: true });
    void import("../m5/audio.ts")
      .then(({ audio }) => {
        audio.warmupFromGesture();
      })
      .catch(() => undefined);
  }, [qualityHydrated, qualitySettings]);

  useEffect(() => {
    const detachSwipe = attachEdgeSwipe({
      enabled: () => !isXiModalOpen() && !modal,
      onSwipeRight: goLobby,
    });
    const detachEsc = attachEscNav({
      enabled: () => !modal && !isXiModalOpen(),
      onEsc: goLobby,
    });
    return () => {
      detachSwipe();
      detachEsc();
    };
  }, [goLobby, modal]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [p, b, v] = await Promise.all([
        fetchProfile(),
        fetchBalance(),
        fetchVip(),
      ]);
      if (cancelled) return;
      setProfile(p);
      setBalance(b);
      setVip(v);
    })();
    return () => {
      cancelled = true;
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

  function openFeat(id: FeatId) {
    switch (id) {
      case "recharge":
        setModal("deposit");
        return;
      case "withdraw":
        setModal("withdraw");
        return;
      case "vip":
        setModal("vip");
        return;
      case "announce":
        setModal("announcements");
        return;
      case "profile":
        setModal("profile");
        return;
      case "settings":
        setModal("settings");
        return;
      case "rules":
        setModal("rules");
        return;
      case "paytable":
        setModal("paytable");
        return;
      case "betHelp":
        setModal("betHelp");
        return;
      case "rankings":
        setModal("rankings");
        return;
      case "records":
        setModal("records");
        return;
      case "activity":
        setModal("activity");
        return;
      case "checkin":
        setModal("checkin");
        return;
      case "cs":
      case "help":
        setPendingKey(`lobby.bdk.feat.${id}`);
        setModal("coming_soon");
        return;
      default:
        setPendingKey("lobby.pending.title");
        setModal("pending");
    }
  }

  function switchLang(next: LobbyLang) {
    saveLobbyLang(next);
  }

  const LANG_TOGGLE_ORDER: LobbyLang[] = ["zh-CN", "my-MM", "en"];
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

  function onStartGame() {
    if (starting) return;
    markXiPerf("routeClickAt", "hub->play");
    setPressing(true);
    setStarting(true);
    markXiPerf("clickFeedbackAt", "hub->play");
    // Ensure warm path; never create Round/Spin here — activate() bootstraps session.
    prefetchSlotAssets();
    warmGameClient({ deferBootstrap: true });
    const tier = qualityHydrated
      ? resolveTier(qualitySettings.mode)
      : ("medium" as const);
    const delay = tier === "low" ? 200 : 220;
    navigateXi({
      href: XI_ROUTES.play,
      from: "hub",
      to: "play",
      ms: delay,
    });
  }

  const nickname =
    profile.status === "ok" && profile.data.nickname
      ? profile.data.nickname
      : profile.status === "loading"
        ? t("lobby.loading")
        : t("lobby.profile.guest");

  const vipLevelFromProfile =
    profile.status === "ok" ? profile.data.vipLevel : null;
  const vipLevelFromApi = vip.status === "ok" ? vip.data.level : null;
  const vipLevel = vipLevelFromApi ?? vipLevelFromProfile;
  const vipLabel =
    vipLevel != null ? `${t("lobby.vip")} ${vipLevel}` : t("lobby.vip");

  const playerIdLabel =
    profile.status === "ok"
      ? shortPlayerId(profile.data.playerId)
      : profile.status === "loading"
        ? "······"
        : "————";

  const mmkText =
    balance.status === "loading"
      ? t("lobby.loading")
      : balance.status === "error"
        ? t("lobby.wallet.error")
        : `${formatMinor(balance.data.balanceMinor, balance.data.currency)}`;

  const mmkCurrency =
    balance.status === "ok" ? balance.data.currency : t("lobby.balance.mmk");

  return (
    <div
      ref={rootRef}
      className="xi-lobby-root xi-bdk-root xi-layout-v2"
      data-testid="xi-bdk-hub"
      lang={lang}
      data-lang={lang}
    >
      {/* Ambient magma wash behind chrome — FX never capture clicks */}
      <div className="xi-bdk-scene xi-bdk-scene-ambient" aria-hidden>
        <div className="xi-bdk-layer xi-bdk-heaven" />
        <div className="xi-bdk-layer xi-bdk-flame" />
        <div className="xi-bdk-layer xi-bdk-lava" />
        <div className="xi-bdk-layer xi-bdk-smoke" />
      </div>

      <div className="xi-bdk-topnav" data-testid="xi-hub-topnav">
        <button
          type="button"
          className="xi-bdk-back-xi"
          data-testid="xi-hub-back-lobby"
          onClick={goLobby}
        >
          ← {t("lobby.bdk.backLobby")}
        </button>
      </div>

      <header className="xi-topbar xi-jade-tablet xi-topbar-v2 xi-bdk-topbar" data-testid="xi-hub-topbar">
        <div className="xi-tablet-cloud" aria-hidden />
        <div className="xi-top-left">
          <button
            type="button"
            className="xi-avatar"
            aria-label={t("lobby.bdk.feat.profile")}
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
            <span className="xi-user-id" data-testid="xi-hub-player-id">
              ID: {playerIdLabel}
            </span>
            <button
              type="button"
              className="xi-vip-pill"
              onClick={() => setModal("vip")}
              data-testid="xi-hub-vip"
            >
              {vipLabel}
            </button>
          </div>
        </div>

        <div className="xi-top-center">
          <div
            className={`xi-wallet-chip${balance.status !== "ok" ? (balance.status === "loading" ? " is-loading" : " is-error") : ""}`}
            data-testid="xi-hub-balance-mmk"
          >
            <span className="xi-wallet-ico xi-wallet-ico-mmk" aria-hidden />
            <span className="xi-wallet-meta">
              <span className="xi-wallet-code">{mmkCurrency}</span>
              <strong>{mmkText}</strong>
            </span>
            <button
              type="button"
              className="xi-wallet-plus"
              aria-label={t("lobby.bdk.feat.recharge")}
              onClick={() => openFeat("recharge")}
            >
              +
            </button>
          </div>
          <div
            className="xi-wallet-chip is-usdt is-loading"
            title={t("lobby.wallet.usdt.pending")}
            data-testid="xi-hub-balance-usdt"
          >
            <span className="xi-wallet-ico xi-wallet-ico-usdt" aria-hidden />
            <span className="xi-wallet-meta">
              <span className="xi-wallet-code">{t("lobby.balance.usdt")}</span>
              <strong>{t("lobby.unavailable")}</strong>
            </span>
            <button
              type="button"
              className="xi-wallet-plus"
              aria-label={t("lobby.bdk.feat.recharge")}
              onClick={() => openFeat("recharge")}
            >
              +
            </button>
          </div>
        </div>

        <div className="xi-top-right">
          <button
            type="button"
            className="xi-icon-btn xi-icon-msg"
            onClick={() => setModal("messages")}
            data-testid="xi-hub-messages"
            aria-label={t("lobby.messages")}
          >
            <span className="xi-ico-envelope" aria-hidden />
            <span className="xi-icon-label">{t("lobby.messages")}</span>
          </button>
          <button
            type="button"
            className="xi-icon-btn xi-icon-settings"
            onClick={() => setModal("settings")}
            data-testid="xi-hub-settings"
            aria-label={t("lobby.settings")}
          >
            <span className="xi-ico-gear" aria-hidden />
            <span className="xi-icon-label">{t("lobby.settings")}</span>
          </button>
          <div className="xi-lang-direct" data-testid="xi-hub-lang-direct" role="group" aria-label={t("lobby.language")}>
            {LANG_TOGGLE_ORDER.map((code) => (
              <button
                key={code}
                type="button"
                className={`xi-lang-direct-btn${lang === code ? " is-active" : ""}`}
                data-testid={`xi-hub-lang-${code}`}
                onClick={() => switchLang(code)}
              >
                {LANG_LABEL[code]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <nav className="xi-breadcrumb" aria-label="breadcrumb" data-testid="xi-hub-breadcrumb">
        <button
          type="button"
          className="xi-crumb-link"
          data-testid="xi-hub-crumb-lobby"
          onClick={goLobby}
        >
          {t("lobby.nav.crumbLobby")}
        </button>
        <span className="xi-crumb-sep" aria-hidden>
          &gt;
        </span>
        <span data-testid="xi-hub-brand">{t("lobby.nav.crumbHub")}</span>
      </nav>

      <main className="xi-bdk-hub xi-bdk-hub-mythic xi-bdk-hub-photo">
        <section
          className="xi-bdk-hero-photo"
          data-testid="xi-hub-hero"
          aria-label={t("lobby.bdk.hubTitle")}
        >
          <ProgressiveHeroImage
            kind="bdk"
            className="xi-bdk-hero-img"
            alt={t("lobby.bdk.hubTitle")}
            testId="xi-hub-hero-img"
            sources={heroSources("bdk")}
            srcSet={heroSrcSet("bdk")}
            avifSrcSet={heroAvifSrcSet("bdk")}
            sizes={heroSizes()}
          />
          <div className="xi-bdk-hero-fx xi-bdk-hero-embers" aria-hidden />
          <div className="xi-bdk-hero-fx xi-bdk-hero-rays" aria-hidden />
          <div className="xi-bdk-hero-copy">
            <p className="xi-bdk-tag">{t("lobby.bdk.hubTag")}</p>
            <h1 data-testid="xi-hub-title">{t("lobby.bdk.hubTitle")}</h1>
            <p data-testid="xi-hub-lead">{t("lobby.bdk.hubLead")}</p>
          </div>
        </section>

        <div className="xi-bdk-actions">
          <button
            type="button"
            className={`xi-primary xi-decree-btn xi-start-game-cta${pressing ? " is-pressing" : ""}${starting ? " is-loading" : ""}`}
            data-testid="xi-start-game"
            disabled={starting}
            aria-busy={starting}
            onMouseEnter={warmPlay}
            onTouchStart={warmPlay}
            onFocus={warmPlay}
            onClick={onStartGame}
          >
            <span className="xi-decree-seal" aria-hidden />
            {starting ? t("lobby.bdk.starting") : t("lobby.bdk.startGame")}
          </button>
        </div>

        <section
          className="xi-bdk-feat-section"
          aria-label={t("lobby.bdk.featSection")}
          data-testid="xi-hub-features"
        >
          <h2 className="xi-section-title">{t("lobby.bdk.featSection")}</h2>
          {FEAT_GROUPS.map((group) => (
            <div
              key={group.id}
              className="xi-bdk-feat-group"
              data-testid={`xi-hub-group-${group.id}`}
            >
              <h3 className="xi-bdk-group-title">{t(group.titleKey)}</h3>
              <div className="xi-bdk-feat-grid">
                {group.items.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="xi-feat-btn"
                    data-testid={`xi-hub-feat-${id}`}
                    onClick={() => openFeat(id)}
                  >
                    <span className="xi-feat-ico" aria-hidden />
                    <span>{t(`lobby.bdk.feat.${id}`)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>

      {modal && (
        <div
          className="xi-modal-backdrop"
          role="presentation"
          data-testid="xi-hub-modal"
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
              <>
                <h2>{t(pendingKey)}</h2>
                <p>{t("lobby.comingSoon")}</p>
                <p>{t("lobby.comingSoon.body")}</p>
              </>
            )}
            {modal === "deposit" && (
              <>
                <h2>{t("lobby.bdk.feat.recharge")}</h2>
                <DepositPanel t={t} lang={lang} onBalanceRefresh={refreshBalance} />
              </>
            )}
            {modal === "withdraw" && (
              <>
                <h2>{t("lobby.bdk.feat.withdraw")}</h2>
                <WithdrawPanel t={t} lang={lang} onBalanceRefresh={refreshBalance} />
              </>
            )}
            {modal === "wallet" && (
              <>
                <h2>{t("lobby.panel.wallet")}</h2>
                <WalletPanel t={t} />
              </>
            )}
            {modal === "activity" && (
              <>
                <h2>{t("lobby.bdk.feat.activity")}</h2>
                <ActivityPanel t={t} lang={lang} onBalanceRefresh={refreshBalance} />
              </>
            )}
            {modal === "checkin" && (
              <>
                <h2>{t("lobby.bdk.feat.checkin")}</h2>
                <CheckinPanel t={t} onBalanceRefresh={refreshBalance} />
              </>
            )}
            {modal === "vip" && (
              <>
                <h2>{t("lobby.bdk.feat.vip")}</h2>
                <VipCenterPanel t={t} lang={lang} />
              </>
            )}
            {modal === "profile" && (
              <>
                <h2>{t("lobby.bdk.feat.profile")}</h2>
                <p>
                  {t("lobby.nickname")}: {nickname}
                </p>
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
            {modal === "rules" && (
              <>
                <h2>{t("lobby.bdk.feat.rules")}</h2>
                <p>{t("lobby.bdk.rules.intro")}</p>
                <p>{t("lobby.bdk.rules.lines")}</p>
                <p>{t("lobby.bdk.rules.wild")}</p>
                <p>{t("lobby.bdk.rules.scatter")}</p>
              </>
            )}
            {modal === "paytable" && (
              <>
                <h2>{t("lobby.bdk.feat.paytable")}</h2>
                <p>{t("lobby.bdk.paytable.intro")}</p>
                <p>{t("lobby.bdk.paytable.note")}</p>
              </>
            )}
            {modal === "betHelp" && (
              <>
                <h2>{t("lobby.bdk.feat.betHelp")}</h2>
                <p>{t("lobby.bdk.betHelp.body")}</p>
              </>
            )}
            {modal === "rankings" && (
              <>
                <h2>{t("lobby.bdk.feat.rankings")}</h2>
                <RankingsPanel t={t} />
              </>
            )}
            {modal === "records" && (
              <>
                <h2>{t("lobby.bdk.feat.records")}</h2>
                <RecordsPanel t={t} />
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
                  testIdPrefix="xi-hub-quality"
                />
                <div className="xi-lang-row">
                  {LOBBY_LANGS.map((code) => (
                    <button
                      key={code}
                      type="button"
                      className={`xi-icon-btn${lang === code ? " is-active" : ""}`}
                      data-testid={`xi-hub-settings-lang-${code}`}
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
                data-testid="xi-hub-modal-close"
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

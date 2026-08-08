"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { fetchVip } from "./api.ts";
import {
  getLobbyLangServerSnapshot,
  loadLobbyLang,
  saveLobbyLang,
  subscribeLobbyLang,
  tLobby,
  type LobbyLang,
} from "./i18n.ts";
import {
  attachEdgeSwipe,
  attachEscNav,
  consumeEnterTransition,
  getOptimisticXiLayer,
  isSpinBusy,
  isXiModalOpen,
  navigateXi,
  resolveEffectiveXiLayer,
  subscribeOptimisticXiLayer,
  XI_ROUTES,
} from "./nav.ts";
import "./lobby.css";

const HUB_HREF = XI_ROUTES.hub;
const LOBBY_HREF = XI_ROUTES.lobby;
const PLAY_LEAVE_ATTR = "data-xi-play-leave";

type LeaveTarget = "hub" | "lobby";

function syncSlotLangFromLobby(lang: LobbyLang, opts?: { dom?: boolean }): void {
  try {
    window.localStorage.setItem("ab-lang", lang);
  } catch {
    /* ignore */
  }
  // Avoid touching <html lang> during module load (SSR hydration mismatch).
  if (opts?.dom !== false) {
    document.documentElement.lang = lang;
  }
}

// Client module load — localStorage only, before first GameClient effect.
if (typeof window !== "undefined") {
  syncSlotLangFromLobby(loadLobbyLang(), { dom: false });
}

/**
 * Step 3 — 《牛魔王》 formal play shell.
 * Chrome / leave safety only — GameClient lives in XiGameHost (suspend/resume).
 */
export default function BdkPlayShell() {
  const pathname = usePathname();
  const optimistic = useSyncExternalStore(
    subscribeOptimisticXiLayer,
    getOptimisticXiLayer,
    () => null,
  );
  const layer = resolveEffectiveXiLayer(pathname);
  const playActive = layer === "play";

  const lang = useSyncExternalStore(
    subscribeLobbyLang,
    loadLobbyLang,
    getLobbyLangServerSnapshot,
  );

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [waitingSafe, setWaitingSafe] = useState(false);
  const [vipLevel, setVipLevel] = useState<number | null>(null);
  const pendingLeave = useRef(false);
  const leaveTarget = useRef<LeaveTarget>("hub");
  const guardArmed = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.title = tLobby(lang, "lobby.page.bdkPlay");
    syncSlotLangFromLobby(lang);
  }, [lang]);

  useEffect(() => {
    // Opacity veil only — do not transform ancestors of #gl / #hud.
    consumeEnterTransition(rootRef.current, { safeForWebgl: true });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchVip().then((vip) => {
      if (cancelled) return;
      if (vip.status === "ok") setVipLevel(vip.data.level);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const goTarget = useCallback((target: LeaveTarget) => {
    pendingLeave.current = false;
    setWaitingSafe(false);
    setConfirmOpen(false);
    const href = target === "lobby" ? LOBBY_HREF : HUB_HREF;
    navigateXi({
      href,
      from: "play",
      to: target === "lobby" ? "lobby" : "hub",
      ms: 220,
    });
  }, []);

  const waitThenLeave = useCallback(() => {
    pendingLeave.current = true;
    setWaitingSafe(true);
    setConfirmOpen(true);
  }, []);

  const requestLeave = useCallback(
    (target: LeaveTarget = "hub") => {
      leaveTarget.current = target;
      if (!isSpinBusy()) {
        goTarget(target);
        return;
      }
      setConfirmOpen(true);
    },
    [goTarget],
  );

  // Poll for safe round end when user chose wait-then-leave
  useEffect(() => {
    if (!waitingSafe) return;
    const id = window.setInterval(() => {
      if (!isSpinBusy()) {
        window.clearInterval(id);
        goTarget(leaveTarget.current);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [waitingSafe, goTarget]);

  // Mark root for HUD leave target + VIP light badge text
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".xi-play-shell");
    root?.setAttribute(PLAY_LEAVE_ATTR, HUB_HREF);
    document.documentElement.setAttribute(PLAY_LEAVE_ATTR, HUB_HREF);

    const vipBtn = document.getElementById("btn-vip");
    if (vipBtn) {
      vipBtn.setAttribute("aria-disabled", "true");
      vipBtn.tabIndex = -1;
      const label =
        vipLevel != null
          ? `${tLobby(lang, "lobby.vip")} ${vipLevel}`
          : tLobby(lang, "lobby.vip");
      vipBtn.setAttribute("title", label);
      vipBtn.setAttribute("data-vip-badge", label);
      if (!vipBtn.querySelector(".xi-play-vip-label")) {
        const span = document.createElement("span");
        span.className = "xi-play-vip-label";
        span.textContent = vipLevel != null ? `V${vipLevel}` : "VIP";
        vipBtn.appendChild(span);
      } else {
        const span = vipBtn.querySelector(".xi-play-vip-label");
        if (span) span.textContent = vipLevel != null ? `V${vipLevel}` : "VIP";
      }
    }

    return () => {
      document.documentElement.removeAttribute(PLAY_LEAVE_ATTR);
    };
  }, [lang, vipLevel]);

  // Intercept in-HUD ← and play back control; history / popstate while busy
  // Only when this shell is the active Play layer (keep-alive may stay mounted hidden).
  useEffect(() => {
    if (!playActive) return;

    const onBackClick = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      if (
        t.closest?.("#btn-back") ||
        t.closest?.("[data-testid='xi-play-back-hub']")
      ) {
        ev.preventDefault();
        ev.stopPropagation();
        requestLeave("hub");
      }
    };

    document.addEventListener("click", onBackClick, true);

    // History guard — only after real /play pathname settles (never clobber in-flight router.push)
    const realPlay =
      resolveEffectiveXiLayer(pathname) === "play" &&
      (pathname ?? "").includes("/play");
    if (!guardArmed.current && realPlay) {
      guardArmed.current = true;
      try {
        window.history.pushState({ xiPlayGuard: 1 }, "", window.location.href);
      } catch {
        /* ignore */
      }
    }

    const onPopState = () => {
      if (!playActive) return;
      if (isSpinBusy() || pendingLeave.current || waitingSafe) {
        try {
          window.history.pushState({ xiPlayGuard: 1 }, "", window.location.href);
        } catch {
          /* ignore */
        }
        leaveTarget.current = "hub";
        if (!waitingSafe) setConfirmOpen(true);
        return;
      }
      navigateXi({
        href: HUB_HREF,
        from: "play",
        to: "hub",
        ms: 200,
        replace: true,
      });
    };
    window.addEventListener("popstate", onPopState);

    const onLangClick = (ev: MouseEvent) => {
      const btn = (ev.target as HTMLElement | null)?.closest?.(".lang-btn") as
        | HTMLButtonElement
        | null;
      if (!btn?.dataset.lang) return;
      const next = btn.dataset.lang;
      if (next === "zh-CN" || next === "en" || next === "my-MM") {
        window.setTimeout(() => saveLobbyLang(next), 0);
      }
    };
    document.addEventListener("click", onLangClick, true);

    return () => {
      document.removeEventListener("click", onBackClick, true);
      document.removeEventListener("click", onLangClick, true);
      window.removeEventListener("popstate", onPopState);
      guardArmed.current = false;
    };
  }, [requestLeave, waitingSafe, playActive]);

  // Edge swipe play→hub; ESC one level — blocked while spin busy / modal / inactive
  useEffect(() => {
    if (!playActive) return;
    const canLeaveIdle = () =>
      playActive &&
      !isSpinBusy() &&
      !confirmOpen &&
      !waitingSafe &&
      !isXiModalOpen();

    const detachSwipe = attachEdgeSwipe({
      enabled: canLeaveIdle,
      onSwipeRight: () => requestLeave("hub"),
    });
    const detachEsc = attachEscNav({
      enabled: () =>
        playActive && !confirmOpen && !waitingSafe && !isXiModalOpen(),
      onEsc: () => requestLeave("hub"),
    });
    return () => {
      detachSwipe();
      detachEsc();
    };
  }, [confirmOpen, waitingSafe, requestLeave, playActive]);

  // Silence unused optimistic read (keeps subscription for layer sync)
  void optimistic;

  return (
    <div
      ref={rootRef}
      className="xi-play-shell xi-play-formal"
      data-testid="xi-bdk-play"
      lang={lang}
      data-lang={lang}
      data-xi-play-leave={HUB_HREF}
    >
      <div className="xi-play-nav-row" data-testid="xi-play-nav">
        <button
          type="button"
          className="xi-play-back"
          data-testid="xi-play-back-hub"
          onClick={(e) => {
            e.preventDefault();
            requestLeave("hub");
          }}
        >
          ← {tLobby(lang, "lobby.bdk.backHub")}
        </button>
        <button
          type="button"
          className="xi-play-home"
          data-testid="xi-play-home-lobby"
          onClick={(e) => {
            e.preventDefault();
            requestLeave("lobby");
          }}
        >
          {tLobby(lang, "lobby.bdk.homeLobby")}
        </button>
      </div>

      <nav
        className="xi-breadcrumb xi-play-breadcrumb"
        aria-label="breadcrumb"
        data-testid="xi-play-breadcrumb"
      >
        <button
          type="button"
          className="xi-crumb-link"
          data-testid="xi-play-crumb-lobby"
          onClick={() => requestLeave("lobby")}
        >
          {tLobby(lang, "lobby.nav.crumbLobby")}
        </button>
        <span className="xi-crumb-sep" aria-hidden>
          &gt;
        </span>
        <button
          type="button"
          className="xi-crumb-link"
          data-testid="xi-play-crumb-hub"
          onClick={() => requestLeave("hub")}
        >
          {tLobby(lang, "lobby.nav.crumbHub")}
        </button>
        <span className="xi-crumb-sep" aria-hidden>
          &gt;
        </span>
        <span data-testid="xi-play-crumb-play">
          {tLobby(lang, "lobby.nav.crumbPlay")}
        </span>
      </nav>

      <div className="xi-play-title-chip" data-testid="xi-play-title" aria-hidden={false}>
        {tLobby(lang, "lobby.page.bdkPlay")}
      </div>

      {vipLevel != null ? (
        <div className="xi-play-vip-chip" data-testid="xi-play-vip-badge" aria-hidden>
          {tLobby(lang, "lobby.vip")} {vipLevel}
        </div>
      ) : null}

      {/* GameClient: persistent XiGameHost under XiShell (no remount on Hub↔Play) */}

      {confirmOpen ? (
        <div
          className="xi-play-leave-mask"
          data-testid="xi-play-leave-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="xi-play-leave-title"
        >
          <div className="xi-play-leave-card">
            <h2 id="xi-play-leave-title">{tLobby(lang, "lobby.play.leaveTitle")}</h2>
            <p>
              {waitingSafe
                ? tLobby(lang, "lobby.play.leaveWaiting")
                : tLobby(lang, "lobby.play.leaveBody")}
            </p>
            <div className="xi-play-leave-actions">
              {!waitingSafe ? (
                <>
                  <button
                    type="button"
                    className="xi-play-leave-stay"
                    data-testid="xi-play-leave-stay"
                    onClick={() => {
                      pendingLeave.current = false;
                      setConfirmOpen(false);
                    }}
                  >
                    {tLobby(lang, "lobby.play.leaveStay")}
                  </button>
                  <button
                    type="button"
                    className="xi-play-leave-wait"
                    data-testid="xi-play-leave-wait"
                    onClick={() => waitThenLeave()}
                  >
                    {tLobby(lang, "lobby.play.leaveWait")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="xi-play-leave-stay"
                  data-testid="xi-play-leave-cancel-wait"
                  onClick={() => {
                    pendingLeave.current = false;
                    setWaitingSafe(false);
                    setConfirmOpen(false);
                  }}
                >
                  {tLobby(lang, "lobby.play.leaveStay")}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

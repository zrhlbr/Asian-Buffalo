/**
 * 《西游戏》 navigation helpers — soft Next.js transitions, edge swipe, ESC.
 * Presentation / routing only. Never touches Wallet / Spin / Math / #hud shell.
 */

import {
  activateGameLifecycle,
  getGameLifecycleState,
  markXiPerf,
  suspendGameLifecycle,
} from "./game-lifecycle.ts";
import { loadLobbyLang, tLobby } from "./i18n.ts";

export type XiNavLayer = "lobby" | "hub" | "play";

export type XiTransitionKind =
  | "slide-left"
  | "slide-right"
  | "zoom-fade"
  | "fade-slide";

export const XI_ROUTES = {
  lobby: "/xi",
  hub: "/xi/bull-demon-king",
  play: "/xi/bull-demon-king/play",
  login: "/xi/login",
  register: "/xi/register",
  forgot: "/xi/forgot",
} as const;

const TRANSITION_KEY = "xi-nav-transition";
const ESC_PREF_KEY = "xi-nav-esc";
const MIN_MS = 180;
const MAX_MS = 260;
const DEFAULT_MS = 220;
const EDGE_PX = 28;

export type XiNavigator = {
  push: (href: string) => void;
  replace: (href: string) => void;
  prefetch: (href: string) => void;
};

let softNavigator: XiNavigator | null = null;

/** Optimistic layer — UI switches before Next pathname settles (Hub↔Play silk). */
let optimisticLayer: XiNavLayer | null = null;
const optimisticListeners = new Set<() => void>();

/** Sync DOM class swap so Hub↔Play paints before React commit (UI-first). */
function applyOptimisticDom(layer: XiNavLayer | null): void {
  if (typeof document === "undefined" || !layer) return;
  const host = document.getElementById("xi-game-host");
  if (host) {
    const play = layer === "play";
    host.classList.toggle("is-active", play);
    host.classList.toggle("is-suspended", !play);
    host.setAttribute("aria-hidden", play ? "false" : "true");
  }
  const hub = document.querySelector<HTMLElement>(
    "[data-testid='xi-hub-keepalive']",
  );
  const playEl = document.querySelector<HTMLElement>(
    "[data-testid='xi-play-keepalive']",
  );
  if (hub) {
    const on = layer === "hub";
    hub.classList.toggle("is-active", on);
    hub.classList.toggle("is-hidden", !on);
    hub.setAttribute("aria-hidden", on ? "false" : "true");
  }
  if (playEl) {
    const on = layer === "play";
    playEl.classList.toggle("is-active", on);
    playEl.classList.toggle("is-hidden", !on);
    playEl.setAttribute("aria-hidden", on ? "false" : "true");
  }
}

export function setOptimisticXiLayer(layer: XiNavLayer | null): void {
  optimisticLayer = layer;
  if (typeof window !== "undefined") {
    (window as unknown as { __xiOptimisticLayer?: XiNavLayer | null }).__xiOptimisticLayer =
      layer;
  }
  applyOptimisticDom(layer);
  for (const l of optimisticListeners) l();
}

export function getOptimisticXiLayer(): XiNavLayer | null {
  return optimisticLayer;
}

export function subscribeOptimisticXiLayer(onChange: () => void): () => void {
  optimisticListeners.add(onChange);
  return () => {
    optimisticListeners.delete(onChange);
  };
}

/** Prefer optimistic layer while soft nav is in flight. */
export function resolveEffectiveXiLayer(pathname?: string): XiNavLayer | null {
  return optimisticLayer ?? resolveXiLayer(pathname);
}

/** Register Next.js router bridge from XiShell (null on unmount). */
export function registerXiNavigator(nav: XiNavigator | null): void {
  softNavigator = nav;
}

export function getXiNavigator(): XiNavigator | null {
  return softNavigator;
}

/** Prefetch Lobby / Hub / Play via registered router. */
export function prefetchXiRoutes(nav?: XiNavigator | null): void {
  const n = nav ?? softNavigator;
  if (!n) return;
  for (const href of [XI_ROUTES.lobby, XI_ROUTES.hub, XI_ROUTES.play]) {
    try {
      n.prefetch(href);
    } catch {
      /* ignore */
    }
  }
}

export function resolveXiLayer(pathname?: string): XiNavLayer | null {
  const path =
    pathname ??
    (typeof window !== "undefined" ? window.location.pathname : "");
  const p = path.replace(/\/$/, "") || "/";
  if (p === "/xi/bull-demon-king/play") return "play";
  if (p === "/xi/bull-demon-king" || p === "/xi/bdk") return "hub";
  if (p === "/xi") return "lobby";
  return null;
}

export function parentXiHref(layer: XiNavLayer): string | null {
  if (layer === "play") return XI_ROUTES.hub;
  if (layer === "hub") return XI_ROUTES.lobby;
  return null;
}

/** ESC one-level — default ON; localStorage `xi-nav-esc` = "0" disables. */
export function isEscNavEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(ESC_PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setEscNavEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(ESC_PREF_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isSpinBusy(): boolean {
  if (typeof document === "undefined") return false;
  const spin = document.getElementById("btn-spin");
  return !!spin?.classList.contains("busy");
}

export function isXiModalOpen(): boolean {
  if (typeof document === "undefined") return false;
  return !!(
    document.querySelector("[data-testid='xi-hub-modal']") ||
    document.querySelector("[data-testid='xi-lobby-modal']") ||
    document.querySelector("[data-testid='xi-play-leave-confirm']") ||
    document.querySelector(".xi-modal-backdrop") ||
    document.querySelector("#paytable-modal:not(.hidden)") ||
    document.querySelector("#settings-modal:not(.hidden)") ||
    document.querySelector("#profile-modal:not(.hidden)") ||
    document.querySelector("#vip-modal:not(.hidden)") ||
    document.querySelector("#wallet-modal:not(.hidden)") ||
    document.querySelector("#help-modal:not(.hidden)")
  );
}

function transitionFor(from: XiNavLayer, to: XiNavLayer): XiTransitionKind {
  if (from === "lobby" && to === "hub") return "slide-left";
  if (from === "hub" && to === "lobby") return "slide-right";
  if (from === "hub" && to === "play") return "zoom-fade";
  if (from === "play" && to === "hub") return "fade-slide";
  if (from === "play" && to === "lobby") return "fade-slide";
  return "fade-slide";
}

function stashEnterTransition(kind: XiTransitionKind): void {
  try {
    sessionStorage.setItem(TRANSITION_KEY, kind);
  } catch {
    /* ignore */
  }
}

function clampMs(ms?: number): number {
  return Math.min(MAX_MS, Math.max(MIN_MS, ms ?? DEFAULT_MS));
}

/**
 * Apply enter animation once after navigation (call on mount).
 * Pass `{ safeForWebgl: true }` on play shell so we never transform a `#gl` ancestor.
 */
export function consumeEnterTransition(
  root?: HTMLElement | null,
  opts?: { safeForWebgl?: boolean },
): void {
  if (typeof document === "undefined") return;
  let kind: string | null = null;
  try {
    kind = sessionStorage.getItem(TRANSITION_KEY);
    sessionStorage.removeItem(TRANSITION_KEY);
  } catch {
    /* ignore */
  }
  if (!kind) return;

  // Play / WebGL: light opacity veil only — never transform #gl or #hud shell parents.
  if (opts?.safeForWebgl) {
    const overlay = document.createElement("div");
    overlay.className = "xi-nav-leave xi-nav-enter-veil xi-nav-leave-soft is-active";
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.classList.remove("is-active");
      overlay.classList.add("is-exit");
    });
    window.setTimeout(() => overlay.remove(), DEFAULT_MS + 40);
    return;
  }

  const el = root ?? document.documentElement;
  const cls = `xi-nav-enter-${kind}`;
  el.classList.add("xi-nav-enter", cls);
  window.setTimeout(() => {
    el.classList.remove("xi-nav-enter", cls);
  }, DEFAULT_MS + 40);
}

export type NavigateXiOpts = {
  href: string;
  from?: XiNavLayer;
  to?: XiNavLayer;
  ms?: number;
  replace?: boolean;
};

/**
 * Soft client navigate (Next router) with light leave veil.
 * Falls back to location only if XiShell has not registered a navigator.
 * Play→Hub: suspend GameClient immediately (async) — never wait for dispose.
 */
export function navigateXi(opts: NavigateXiOpts): void {
  if (typeof window === "undefined") return;
  const from = opts.from ?? resolveXiLayer() ?? "lobby";
  const to = opts.to ?? resolveXiLayer(opts.href) ?? "lobby";
  const kind = transitionFor(from, to);
  const ms = clampMs(opts.ms);
  stashEnterTransition(kind);

  markXiPerf("routeClickAt", `${from}->${to}`);
  // Immediate click feedback (≤80ms) — sync class before paint
  document.documentElement.classList.add("xi-nav-pending", "xi-nav-busy");
  markXiPerf("clickFeedbackAt", `${from}->${to}`);
  // Optimistic UI layer — Hub↔Play chrome/host switch before RSC pathname settles
  setOptimisticXiLayer(to);

  if (from === "play") {
    // UI-first leave: pause + hide host now; do NOT dispose / await WebGL teardown
    window.dispatchEvent(new CustomEvent("xi-game-pause"));
    try {
      const tier =
        document.documentElement.getAttribute("data-xi-tier") ?? "medium";
      suspendGameLifecycle({ releaseHeavyFx: tier === "low" });
    } catch {
      /* ignore */
    }
  }

  // Warm Hub→Play: show suspended host before RSC swap so reels appear during veil
  if (to === "play") {
    const st = getGameLifecycleState();
    if (st === "READY" || st === "SUSPENDED" || st === "ACTIVE") {
      const label = tLobby(loadLobbyLang(), "lobby.play.loading");
      void activateGameLifecycle(label);
    }
  }

  const overlay = document.createElement("div");
  overlay.className = `xi-nav-leave xi-nav-leave-soft xi-nav-leave-${kind}`;
  overlay.setAttribute("data-testid", "xi-nav-transition");
  overlay.setAttribute("aria-hidden", "true");
  document.documentElement.appendChild(overlay);
  void overlay.offsetWidth;
  overlay.classList.add("is-active");

  const go = () => {
    const nav = softNavigator;
    if (nav) {
      if (opts.replace) nav.replace(opts.href);
      else nav.push(opts.href);
    } else if (opts.replace) {
      window.location.replace(opts.href);
    } else {
      window.location.assign(opts.href);
    }
    // Soft nav keeps prior tree until RSC ready — fade veil out quickly
    window.setTimeout(() => {
      overlay.classList.add("is-exit");
      overlay.classList.remove("is-active");
      window.setTimeout(() => {
        overlay.remove();
        markXiPerf("transitionEnd", `${from}->${to}`);
      }, ms);
      document.documentElement.classList.remove("xi-nav-pending");
    }, 32);
  };

  // Push ASAP for Hub↔Play once warm; veil still animates for 200–260ms.
  const st = getGameLifecycleState();
  const warmPlay =
    to === "play" && (st === "READY" || st === "SUSPENDED" || st === "ACTIVE");
  const delay =
    from === "play" || to === "play"
      ? warmPlay || from === "play"
        ? 0
        : Math.min(ms, 200)
      : ms;
  if (delay <= 0) {
    go();
  } else {
    window.setTimeout(go, delay);
  }
}

export type EdgeSwipeOpts = {
  enabled: () => boolean;
  onSwipeRight: () => void;
  edgePx?: number;
};

/** Left-edge LTR swipe → one level up. Disabled when `enabled()` is false. */
export function attachEdgeSwipe(opts: EdgeSwipeOpts): () => void {
  if (typeof window === "undefined") return () => {};
  const edge = opts.edgePx ?? EDGE_PX;
  let startX = 0;
  let startY = 0;
  let tracking = false;

  const onStart = (ev: TouchEvent) => {
    if (!opts.enabled()) return;
    const t = ev.touches[0];
    if (!t || t.clientX > edge) return;
    tracking = true;
    startX = t.clientX;
    startY = t.clientY;
  };

  const onMove = (ev: TouchEvent) => {
    if (!tracking) return;
    const t = ev.touches[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = Math.abs(t.clientY - startY);
    if (dx > 12 && dx > dy * 1.2) {
      ev.preventDefault();
    }
  };

  const onEnd = (ev: TouchEvent) => {
    if (!tracking) return;
    tracking = false;
    if (!opts.enabled()) return;
    const t = ev.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = Math.abs(t.clientY - startY);
    if (dx >= 64 && dx > dy * 1.35) {
      opts.onSwipeRight();
    }
  };

  const onCancel = () => {
    tracking = false;
  };

  window.addEventListener("touchstart", onStart, { passive: true });
  window.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("touchend", onEnd, { passive: true });
  window.addEventListener("touchcancel", onCancel, { passive: true });

  return () => {
    window.removeEventListener("touchstart", onStart);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("touchend", onEnd);
    window.removeEventListener("touchcancel", onCancel);
  };
}

export type EscNavOpts = {
  enabled?: () => boolean;
  onEsc: () => void;
};

/** ESC → one level (skip when modal open / disabled). */
export function attachEscNav(opts: EscNavOpts): () => void {
  if (typeof window === "undefined") return () => {};
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape") return;
    if (!isEscNavEnabled()) return;
    if (opts.enabled && !opts.enabled()) return;
    if (isXiModalOpen()) return;
    ev.preventDefault();
    opts.onEsc();
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}

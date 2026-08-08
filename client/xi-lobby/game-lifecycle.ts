/**
 * Hub↔Play GameClient lifecycle — presentation only.
 * State machine + perf trace. Never creates Round/Spin/Session APIs here.
 */

export type GameLifecycleState =
  | "UNINITIALIZED"
  | "PRELOADING"
  | "READY"
  | "ACTIVE"
  | "SUSPENDED"
  | "DISPOSING"
  | "DISPOSED";

export type XiPerfMarkName =
  | "routeClickAt"
  | "clickFeedbackAt"
  | "preloadStart"
  | "preloadReady"
  | "bootStart"
  | "bootReady"
  | "activateStart"
  | "activateReady"
  | "suspendStart"
  | "suspendDone"
  | "overlayShown"
  | "transitionEnd";

export type XiPerfMark = {
  name: XiPerfMarkName;
  t: number;
  detail?: string;
};

type HostController = {
  requestMount: (opts?: { deferBootstrap?: boolean }) => void;
  requestUnmount: () => void;
  setVisible: (active: boolean) => void;
};

type BootBridge = {
  pause: (opts?: { releaseHeavyFx?: boolean }) => void;
  resume: () => void;
  ensureBootstrap: () => void;
  destroy: () => void;
  isBootstrapped: () => boolean;
};

const PERF_KEY = "xi-perf-trace";
const listeners = new Set<() => void>();

let state: GameLifecycleState = "UNINITIALIZED";
let host: HostController | null = null;
let boot: BootBridge | null = null;
let preloadPromise: Promise<void> | null = null;
let bootPromise: Promise<void> | null = null;
let overlayTimer: number | null = null;
let loadingOverlay: HTMLElement | null = null;
let opSeq = 0;
let deferPending = true;

function emit(): void {
  for (const l of listeners) l();
}

function setState(next: GameLifecycleState): void {
  if (state === next) return;
  state = next;
  if (typeof window !== "undefined") {
    const w = window as unknown as { __xiGameLifecycle?: string };
    w.__xiGameLifecycle = next;
  }
  emit();
}

export function getGameLifecycleState(): GameLifecycleState {
  return state;
}

export function subscribeGameLifecycle(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function registerGameHostController(ctrl: HostController | null): void {
  host = ctrl;
}

export function registerBootBridge(bridge: BootBridge | null): void {
  boot = bridge;
  if (bridge && (state === "PRELOADING" || state === "UNINITIALIZED" || state === "READY")) {
    setState("READY");
    markXiPerf("bootReady");
    // Warm path on Hub: keep RAF/audio paused until activate()
    if (state !== "ACTIVE") {
      try {
        bridge.pause();
      } catch {
        /* ignore */
      }
    }
  }
}

export function isXiPerfTraceEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("xiPerf") === "1") {
      return true;
    }
    return window.localStorage.getItem(PERF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setXiPerfTraceEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(PERF_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function markXiPerf(name: XiPerfMarkName, detail?: string): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    __xiPerfMarks?: XiPerfMark[];
    __xiPerfEnabled?: boolean;
  };
  const enabled = isXiPerfTraceEnabled();
  w.__xiPerfEnabled = enabled;
  if (!enabled && !w.__xiPerfMarks) return;
  if (!w.__xiPerfMarks) w.__xiPerfMarks = [];
  const entry: XiPerfMark = { name, t: performance.now(), detail };
  w.__xiPerfMarks.push(entry);
  if (enabled) {
    console.info(`[xi-perf] ${name}`, detail ?? "", entry.t.toFixed(1));
  }
}

export function clearXiPerfMarks(): void {
  if (typeof window === "undefined") return;
  (window as unknown as { __xiPerfMarks?: XiPerfMark[] }).__xiPerfMarks = [];
}

function clearOverlayTimer(): void {
  if (overlayTimer != null) {
    window.clearTimeout(overlayTimer);
    overlayTimer = null;
  }
}

export function hideXiPlayLoadingOverlay(): void {
  clearOverlayTimer();
  if (loadingOverlay) {
    loadingOverlay.classList.add("is-exit");
    const el = loadingOverlay;
    loadingOverlay = null;
    window.setTimeout(() => el.remove(), 220);
  }
}

export function showXiPlayLoadingOverlay(label: string): void {
  if (typeof document === "undefined") return;
  if (loadingOverlay) return;
  markXiPerf("overlayShown");
  const el = document.createElement("div");
  el.className = "xi-play-loading is-active";
  el.setAttribute("data-testid", "xi-play-loading");
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = `<div class="xi-play-loading-card"><span class="xi-play-loading-brand">西游戏</span><span class="xi-play-loading-text">${label}</span></div>`;
  document.documentElement.appendChild(el);
  loadingOverlay = el;
}

/** Schedule light loading overlay if enter path exceeds 150ms. */
export function armXiPlayLoadingOverlay(label: string): void {
  clearOverlayTimer();
  overlayTimer = window.setTimeout(() => {
    overlayTimer = null;
    if (state !== "ACTIVE") showXiPlayLoadingOverlay(label);
  }, 150);
}

/**
 * Priority-1 asset prefetch only (chunks / images). No WebGL, no Session.
 * Does not advance the GameClient state machine (warmGameClient owns PRELOADING).
 */
export async function prefetchPlayCoreAssets(
  run: () => Promise<void>,
): Promise<void> {
  if (preloadPromise) return preloadPromise;
  markXiPerf("preloadStart");
  preloadPromise = (async () => {
    try {
      await run();
      markXiPerf("preloadReady");
    } catch {
      /* ignore — navigation / warm will retry */
    } finally {
      preloadPromise = null;
    }
  })();
  return preloadPromise;
}

/**
 * Warm hidden GameClient (WebGL/shaders) without Session/Spin/Round.
 * Safe on hub idle after hover/touchstart / idle timer.
 */
export function warmGameClient(opts?: { deferBootstrap?: boolean }): void {
  if (typeof window === "undefined") return;
  if (
    state === "READY" ||
    state === "ACTIVE" ||
    state === "SUSPENDED" ||
    state === "DISPOSING"
  ) {
    return;
  }
  deferPending = opts?.deferBootstrap !== false;
  markXiPerf("bootStart");
  setState("PRELOADING");
  host?.requestMount({ deferBootstrap: deferPending });
}

export function notifyBootStarted(): void {
  markXiPerf("bootStart");
}

export function notifyBootReady(): void {
  if (state === "DISPOSING" || state === "DISPOSED") return;
  markXiPerf("bootReady");
  if (state !== "ACTIVE") {
    setState("READY");
    try {
      boot?.pause();
    } catch {
      /* ignore */
    }
  }
}

function isPlayIntent(): boolean {
  if (typeof window === "undefined") return false;
  const opt = (window as unknown as { __xiOptimisticLayer?: string | null })
    .__xiOptimisticLayer;
  if (opt === "hub" || opt === "lobby") return false;
  if (opt === "play") return true;
  return window.location.pathname.includes("/play");
}

/**
 * Enter Play visually — show host, resume RAF/audio, bootstrap session if deferred.
 */
export async function activateGameLifecycle(loadingLabel: string): Promise<void> {
  const seq = ++opSeq;
  markXiPerf("activateStart");
  armXiPlayLoadingOverlay(loadingLabel);

  if (state === "DISPOSING") {
    // Wait out dispose — rare
    await new Promise((r) => setTimeout(r, 50));
  }

  if (!isPlayIntent()) {
    hideXiPlayLoadingOverlay();
    return;
  }

  if (state === "UNINITIALIZED" || state === "PRELOADING" || state === "DISPOSED") {
    deferPending = false;
    host?.requestMount({ deferBootstrap: false });
  }

  host?.setVisible(true);

  // Wait briefly for boot bridge if cold
  if (!boot) {
    bootPromise =
      bootPromise ??
      new Promise<void>((resolve) => {
        const start = performance.now();
        const tick = () => {
          if (boot || performance.now() - start > 8000) {
            bootPromise = null;
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      });
    await bootPromise;
  }

  if (seq !== opSeq || !isPlayIntent()) {
    hideXiPlayLoadingOverlay();
    return;
  }

  try {
    boot?.resume();
    boot?.ensureBootstrap();
  } catch {
    /* ignore */
  }

  if (seq !== opSeq || !isPlayIntent()) {
    hideXiPlayLoadingOverlay();
    try {
      boot?.pause();
    } catch {
      /* ignore */
    }
    host?.setVisible(false);
    return;
  }

  setState("ACTIVE");
  markXiPerf("activateReady");
  hideXiPlayLoadingOverlay();
  markXiPerf("transitionEnd");
}

/**
 * Leave Play — UI may navigate immediately. Pause + hide; do NOT dispose.
 */
export function suspendGameLifecycle(opts?: {
  releaseHeavyFx?: boolean;
}): void {
  const seq = ++opSeq;
  markXiPerf("suspendStart");
  hideXiPlayLoadingOverlay();
  try {
    boot?.pause({ releaseHeavyFx: opts?.releaseHeavyFx === true });
  } catch {
    /* ignore */
  }
  host?.setVisible(false);
  if (state === "ACTIVE" || state === "READY" || state === "PRELOADING") {
    setState("SUSPENDED");
  }
  markXiPerf("suspendDone");
  void seq;
}

/**
 * Full teardown — only when leaving Xi segment or forced reset.
 * Never call on routine Play→Hub.
 */
export function disposeGameLifecycle(): void {
  if (state === "DISPOSED" || state === "DISPOSING") return;
  const seq = ++opSeq;
  setState("DISPOSING");
  hideXiPlayLoadingOverlay();
  try {
    boot?.destroy();
  } catch {
    /* ignore */
  }
  boot = null;
  host?.requestUnmount();
  if (seq === opSeq) setState("DISPOSED");
}

export function shouldDeferBootstrap(): boolean {
  return deferPending && state !== "ACTIVE";
}

export function getLifecycleDebug(): {
  state: GameLifecycleState;
  hasBoot: boolean;
  hasHost: boolean;
} {
  return { state, hasBoot: !!boot, hasHost: !!host };
}

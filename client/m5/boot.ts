/**
 * M5/M6 boot — single formal frontend entry (Three.js + HUD).
 * Uses FormalGameProvider only. Isolated demo providers are never imported here.
 */
import "./styles.css";
import * as THREE from "three";
import { World } from "./scene/world.ts";
import { Particles } from "./scene/particles.ts";
import { Buffalo } from "./scene/buffalo.ts";
import { ReelRig } from "./game/reels.ts";
import { Game } from "./game/game.ts";
import { Hud } from "./ui/hud.ts";
import { FormalGameProvider } from "./formal-provider.ts";
import { validateDicts, getLang, setLang, type Lang } from "./i18n.ts";
import { preloadSymbolArt } from "./game/symbols.ts";
import {
  allowDebugHooks,
  applyDocumentTierAttrs,
  applySettingsToProfile,
  FramePacer,
  FpsGovernor,
  profileFor,
  readStoredQualitySettings,
  resolveTier,
  storeQualitySettings,
  withSoftRenderScale,
  type QualityMode,
  type QualitySettings,
  type QualityTier,
} from "./quality.ts";
import { audio } from "./audio.ts";
import type { SymbolId } from "./adapter.ts";

export type BootM5Options = {
  /** Warm WebGL without Session/Spin/Round until ensureBootstrap(). */
  deferBootstrap?: boolean;
};

export type M5Handle = {
  destroy: () => void;
  /** Pause rAF + audio for soft nav (keep WebGL context). */
  pause: (opts?: { releaseHeavyFx?: boolean }) => void;
  /** Resume after soft nav / tab return. */
  resume: () => void;
  /** Start formal session bootstrap once (idempotent). */
  ensureBootstrap: () => void;
  isBootstrapped: () => boolean;
  game: Game;
};

function buildProfile(tier: QualityTier, settings: QualitySettings) {
  return applySettingsToProfile(profileFor(tier), settings);
}

export function bootM5(root: HTMLElement, opts?: BootM5Options): M5Handle {
  const i18nProblems = validateDicts();
  if (i18nProblems.length) console.warn("[i18n] dictionary issues:", i18nProblems);

  const canvas = root.querySelector<HTMLCanvasElement>("#gl");
  if (!canvas) throw new Error("M5 canvas #gl missing");

  let qualitySettings = readStoredQualitySettings();
  let qualityMode = qualitySettings.mode;
  let activeTier = resolveTier(qualityMode);
  let profile = buildProfile(activeTier, qualitySettings);
  let sessionBootstrapped = false;
  let savedCoinBudget = profile.coinBudget;
  let savedParticleBudget = profile.particleBudget;

  const world = new World(canvas, profile);
  const particles = new Particles(world.scene);
  particles.setBudgets(profile.coinBudget, profile.particleBudget);
  const buffalo = new Buffalo(profile.furShells);
  buffalo.setAnimMode(qualitySettings.animalMode);
  buffalo.setParticles(particles);
  world.scene.add(buffalo.group);
  audio.setMaxConcurrentSfx(activeTier === "low" ? 4 : activeTier === "medium" ? 6 : 8);

  const rig = new ReelRig();
  world.scene.add(rig.group);
  /** Read CSS safe-area insets (notch / home indicator) when available. */
  const readSidePadPx = (): number => {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;left:0;top:0;width:env(safe-area-inset-left,0px);height:0;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
    const left = probe.getBoundingClientRect().width;
    probe.style.width = "env(safe-area-inset-right,0px)";
    const right = probe.getBoundingClientRect().width;
    probe.remove();
    // Minimum 2px optical gutter; expand for real notches
    return Math.max(2, left, right, 2);
  };

  /** M8 P0: reels full-bleed; buffalo becomes background atmosphere. */
  const applyAspect = () => {
    const w = root.clientWidth;
    const h = Math.max(root.clientHeight, 1);
    const aspect = w / h;
    const sidePad = readSidePadPx();
    const fov = world.applyCommercialFov(aspect, w, h);
    // Iterate so camera z and reel scale converge on near-edge fill
    for (let i = 0; i < 4; i++) {
      rig.setAspect(aspect, world.getCameraZ(), fov, sidePad, w, h);
      world.setFrameHalfWidth(rig.scaledFrameHalfWidth());
    }
    // Buffalo deep background — never compete with reel width
    if (aspect < 1.05) {
      buffalo.setHomeLayout(-3.8, 0, -4.2, 0.55);
    } else if (aspect <= 2.55) {
      buffalo.setHomeLayout(-10.5, 0, -5.2, 0.5);
    } else {
      buffalo.setHomeLayout(-9.0, 0, -3.2, 0.78);
    }
  };
  applyAspect();

  const artReady = Promise.race([
    preloadSymbolArt(),
    new Promise<void>((r) => setTimeout(r, 2800)),
  ]);

  const provider = new FormalGameProvider();
  const game = new Game(provider, rig, buffalo, particles, world);
  const pacer = new FramePacer(qualitySettings.fpsTarget);
  let governor!: FpsGovernor;

  const applyQualityBundle = (tier: QualityTier, settings: QualitySettings, softScale = 1) => {
    activeTier = tier;
    profile = withSoftRenderScale(buildProfile(tier, settings), softScale);
    world.applyQuality(profile);
    buffalo.setFurShells(profile.furShells);
    buffalo.setAnimMode(settings.animalMode);
    particles.setBudgets(profile.coinBudget, profile.particleBudget);
    savedCoinBudget = profile.coinBudget;
    savedParticleBudget = profile.particleBudget;
    rig.setSymbolAnimIntensity(profile.symbolAnimIntensity);
    audio.setMaxConcurrentSfx(tier === "low" ? 4 : tier === "medium" ? 6 : 8);
    pacer.setTarget(settings.fpsTarget);
    applyDocumentTierAttrs(tier, settings);
  };
  applyDocumentTierAttrs(activeTier, qualitySettings);

  governor = new FpsGovernor(
    activeTier,
    (tier: QualityTier, softScale = 1) => {
      if (qualityMode !== "auto") return;
      // Soft scale is DEGRADE_ORDER last step — only low tier, never Symbol plate
      applyQualityBundle(tier, qualitySettings, softScale);
    },
    35,
    55,
    { sustainMs: 3800, allowStepUp: false },
  );

  const hud = new Hud(game, {
    getQualityMode: () => qualityMode,
    getQualitySettings: () => qualitySettings,
    setQualityMode: (mode: QualityMode) => {
      qualitySettings = { ...qualitySettings, mode };
      qualityMode = mode;
      storeQualitySettings(qualitySettings);
      const tier = resolveTier(mode);
      applyQualityBundle(tier, qualitySettings);
      if (qualityMode === "auto") {
        governor.setAutoCeiling(tier);
      } else {
        governor.setManual(tier);
      }
    },
    setQualitySettings: (partial: Partial<QualitySettings>) => {
      qualitySettings = { ...qualitySettings, ...partial };
      qualityMode = qualitySettings.mode;
      storeQualitySettings(qualitySettings);
      const tier =
        qualityMode === "auto" ? governor.current : resolveTier(qualityMode);
      applyQualityBundle(tier, qualitySettings);
      if (qualityMode === "auto") {
        governor.setAutoCeiling(resolveTier("auto"));
      } else {
        governor.setManual(tier);
      }
    },
  });
  void hud;

  const ensureBootstrap = () => {
    if (sessionBootstrapped) return;
    sessionBootstrapped = true;
    void game.bootstrap().catch((err) => {
      console.error("[m5] bootstrap failed", err);
      const loading = root.querySelector("#loading-text");
      if (loading) loading.textContent = String(err?.message ?? err);
    });
  };
  if (!opts?.deferBootstrap) ensureBootstrap();

  if (allowDebugHooks()) {
    const debug = {
      game,
      rig,
      buffalo,
      world,
      setLang: (l: Lang) => setLang(l),
      getLang,
      spin: () => void game.spin(),
      setQuality: (mode: QualityMode) => hud.setQualityMode?.(mode),
      state: () => ({
        lang: getLang(),
        busy: game.busy,
        freeSpins: game.freeSpins,
        balance: provider.getBalance(),
        bet: game.bet,
        sessionId: provider.getSessionId(),
        mathVersionId: provider.getMathVersionId(),
        auto: game.autoMode,
        turbo: game.turbo,
        qualityMode,
        qualityTier: activeTier,
        qualitySettings,
        reelScale: rig.scaleFactor,
        reelX: rig.group.position.x,
        camZ: world.getCameraZ(),
        fov: world.camera.fov,
        edge: rig.measureScreenFill(world.camera),
        clarity: world.getClarityProbe(),
      }),
    };
    (window as unknown as { __game: typeof debug }).__game = debug;
  } else {
    try {
      delete (window as unknown as { __game?: unknown }).__game;
    } catch {
      /* ignore */
    }
  }

  const clock = new THREE.Clock();
  let raf = 0;
  let alive = true;
  let pageVisible = !document.hidden;

  // Initial symbol-life LOD from quality profile
  rig.setSymbolAnimIntensity(profile.symbolAnimIntensity);

  const onResize = () => {
    world.resize();
    applyAspect();
  };
  window.addEventListener("resize", onResize);

  const onVisibility = () => {
    pageVisible = !document.hidden;
    if (document.hidden) {
      audio.setBackgroundDimmed(true);
      audio.pauseForBackground();
      clock.getDelta(); // discard large dt on resume
    } else {
      audio.resumeFromBackground();
      audio.setBackgroundDimmed(false);
      clock.getDelta();
      // Formal balance refresh on page resume (wallet is source of truth).
      void game.refreshBalanceFromWallet();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  function frame(): void {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (!pageVisible) return;
    const now = performance.now();
    if (!pacer.shouldDraw(now)) {
      if (qualityMode === "auto") governor.tick(now);
      return;
    }
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    world.update(dt);
    rig.update(dt, time);
    buffalo.update(dt, time);
    particles.update(dt, time);
    world.render();
    if (qualityMode === "auto") {
      governor.tick(now);
    }
  }
  frame();

  const loading = root.querySelector("#loading");
  // Always release the loading trap — never leave a full-screen blocker on HUD
  void artReady.finally(() => {
    window.setTimeout(() => loading?.classList.add("done"), 200);
  });
  window.setTimeout(() => loading?.classList.add("done"), 4000);

  return {
    game,
    ensureBootstrap,
    isBootstrapped: () => sessionBootstrapped,
    pause: (pauseOpts?: { releaseHeavyFx?: boolean }) => {
      pageVisible = false;
      try {
        audio.pauseForBackground();
      } catch {
        /* ignore */
      }
      // LOW tier: drop heavy FX budgets while suspended (keep WebGL context)
      if (pauseOpts?.releaseHeavyFx) {
        savedCoinBudget = profile.coinBudget;
        savedParticleBudget = profile.particleBudget;
        particles.setBudgets(0, 0);
      }
    },
    resume: () => {
      pageVisible = true;
      clock.getDelta();
      try {
        particles.setBudgets(savedCoinBudget, savedParticleBudget);
        audio.resumeFromBackground();
        audio.setBackgroundDimmed(false);
      } catch {
        /* ignore */
      }
    },
    destroy: () => {
      alive = false;
      pageVisible = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      try {
        delete (window as unknown as { __game?: unknown }).__game;
      } catch {
        /* ignore */
      }
      try {
        audio.pauseForBackground();
      } catch {
        /* ignore */
      }
      try {
        // Safe dispose — host unmount only (not routine Play→Hub suspend)
        world.dispose();
      } catch {
        /* ignore */
      }
    },
  };
}

// Keep SymbolId exported for QA typings without pulling mock.
export type { SymbolId };

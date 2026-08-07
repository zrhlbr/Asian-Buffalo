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
  FpsGovernor,
  profileFor,
  readStoredQualityMode,
  resolveTier,
  storeQualityMode,
  type QualityMode,
  type QualityTier,
} from "./quality.ts";
import { audio } from "./audio.ts";
import type { SymbolId } from "./adapter.ts";

export type M5Handle = {
  destroy: () => void;
  game: Game;
};

export function bootM5(root: HTMLElement): M5Handle {
  const i18nProblems = validateDicts();
  if (i18nProblems.length) console.warn("[i18n] dictionary issues:", i18nProblems);

  const canvas = root.querySelector<HTMLCanvasElement>("#gl");
  if (!canvas) throw new Error("M5 canvas #gl missing");

  let qualityMode = readStoredQualityMode();
  let activeTier = resolveTier(qualityMode);
  let profile = profileFor(activeTier);

  const world = new World(canvas, profile);
  const particles = new Particles(world.scene);
  particles.setBudgets(profile.coinBudget, profile.particleBudget);
  const buffalo = new Buffalo(profile.furShells);
  buffalo.setParticles(particles);
  world.scene.add(buffalo.group);

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
  const hud = new Hud(game, {
    getQualityMode: () => qualityMode,
    setQualityMode: (mode: QualityMode) => {
      qualityMode = mode;
      storeQualityMode(mode);
      activeTier = resolveTier(mode);
      profile = profileFor(activeTier);
      world.applyQuality(profile);
      buffalo.setFurShells(profile.furShells);
      particles.setBudgets(profile.coinBudget, profile.particleBudget);
      rig.setSymbolAnimIntensity(profile.symbolAnimIntensity);
      if (qualityMode === "auto") {
        governor.setAutoCeiling(activeTier);
      } else {
        governor.setManual(activeTier);
      }
    },
  });
  void hud;

  void game.bootstrap().catch((err) => {
    console.error("[m5] bootstrap failed", err);
    const loading = root.querySelector("#loading-text");
    if (loading) loading.textContent = String(err?.message ?? err);
  });

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
        reelScale: rig.scaleFactor,
        reelX: rig.group.position.x,
        camZ: world.getCameraZ(),
        fov: world.camera.fov,
        edge: rig.measureScreenFill(world.camera),
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

  const governor = new FpsGovernor(activeTier, (tier: QualityTier) => {
    if (qualityMode !== "auto") return;
    activeTier = tier;
    profile = profileFor(tier);
    world.applyQuality(profile);
    buffalo.setFurShells(profile.furShells);
    particles.setBudgets(profile.coinBudget, profile.particleBudget);
    rig.setSymbolAnimIntensity(profile.symbolAnimIntensity);
  });

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
      clock.getDelta(); // discard large dt on resume
    } else {
      audio.setBackgroundDimmed(false);
      clock.getDelta();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  function frame(): void {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (!pageVisible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    world.update(dt);
    rig.update(dt, time);
    buffalo.update(dt, time);
    particles.update(dt, time);
    world.render();
    if (qualityMode === "auto") {
      governor.tick(performance.now());
    }
  }
  frame();

  const loading = root.querySelector("#loading");
  void artReady.finally(() => {
    window.setTimeout(() => loading?.classList.add("done"), 200);
  });

  return {
    game,
    destroy: () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      try {
        delete (window as unknown as { __game?: unknown }).__game;
      } catch {
        /* ignore */
      }
      try {
        world.dispose();
      } catch {
        /* ignore */
      }
    },
  };
}

// Keep SymbolId exported for QA typings without pulling mock.
export type { SymbolId };

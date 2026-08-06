/**
 * M5 boot — single formal frontend entry (Three.js + HUD).
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

  const world = new World(canvas);
  const particles = new Particles(world.scene);
  const buffalo = new Buffalo();
  buffalo.setParticles(particles);
  world.scene.add(buffalo.group);

  const rig = new ReelRig();
  world.scene.add(rig.group);
  const applyAspect = () =>
    rig.setAspect(root.clientWidth / Math.max(root.clientHeight, 1));
  applyAspect();

  const provider = new FormalGameProvider();
  const game = new Game(provider, rig, buffalo, particles, world);
  const hud = new Hud(game);
  void hud;

  void game.bootstrap().catch((err) => {
    console.error("[m5] bootstrap failed", err);
    const loading = root.querySelector("#loading-text");
    if (loading) loading.textContent = String(err?.message ?? err);
  });

  const debug = {
    game,
    setLang: (l: Lang) => setLang(l),
    getLang,
    spin: () => void game.spin(),
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
    }),
  };
  (window as unknown as { __game: typeof debug }).__game = debug;

  const clock = new THREE.Clock();
  let slowFrames = 0;
  let degraded = false;
  let raf = 0;
  let alive = true;

  const onResize = () => {
    applyAspect();
    world.resize();
  };
  window.addEventListener("resize", onResize);

  function frame(): void {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    world.update(dt);
    rig.update(dt, time);
    buffalo.update(dt, time);
    particles.update(dt, time);
    world.render();
    if (!degraded) {
      if (dt > 0.024) slowFrames++;
      else slowFrames = Math.max(0, slowFrames - 2);
      if (slowFrames > 90) {
        degraded = true;
        world.renderer.setPixelRatio(1);
        world.resize();
      }
    }
  }
  frame();

  const loading = root.querySelector("#loading");
  window.setTimeout(() => loading?.classList.add("done"), 500);

  return {
    game,
    destroy: () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      try {
        world.renderer.dispose();
      } catch {
        /* ignore */
      }
    },
  };
}

// Keep SymbolId exported for QA typings without pulling mock.
export type { SymbolId };

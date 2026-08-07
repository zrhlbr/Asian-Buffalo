/**
 * M6-2 · 场景编排器（懒加载入口，仅客户端动态 import）
 * 组合：草原环境 + 水牛 + HDR 后处理 + 镜头动画 + 画质 LOD 调度。
 */
import * as THREE from "three";
import { createBuffalo, type BuffaloRig } from "./buffalo";
import { createSavanna, type SavannaEnv } from "./savanna";
import { createPostFx, type PostFx } from "./postfx";
import type { QualityProfile } from "../quality";
import type { SceneHandle, SceneOptions, WinTier } from "./types";

export async function createSavannaScene(
  canvas: HTMLCanvasElement,
  options: SceneOptions,
): Promise<SceneHandle> {
  const profile = options.initialQuality;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, profile.pixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // HDR → ACES
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2("#dcc79b", 0.012);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 260);
  const camBase = new THREE.Vector3(0.4, 2.1, 8.6);
  camera.position.copy(camBase);
  camera.lookAt(0.4, 1.3, 0);

  const env: SavannaEnv = createSavanna({
    grassCount: profile.grassCount,
    treeCount: profile.treeCount,
    cloudCount: profile.cloudCount,
    groundFog: profile.enableGroundFog,
  });
  scene.add(env.group);

  const buffalo: BuffaloRig = createBuffalo(profile.furShells);
  buffalo.group.position.set(-0.6, 0, -0.4);
  scene.add(buffalo.group);

  let post: PostFx | null = null;
  const wantsPost = profile.enableBloom || profile.enableGodRays || profile.enableDof;
  if (wantsPost) {
    post = createPostFx(renderer, scene, camera, { width: 1, height: 1 }, {
      bloom: profile.enableBloom,
      godRays: profile.enableGodRays,
      dof: profile.enableDof,
    });
  }

  // ---- 尺寸 ----
  function resize(): void {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post?.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  }
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  // ---- 镜头动画状态 ----
  let shakeAmp = 0;
  let fovPunch = 0;
  let duskK = 0;
  let duskTarget = 0;
  let boostK = 0;
  let boostTarget = 0;

  const TIER_FX: Record<WinTier, { shake: number; punch: number; boost: number }> = {
    big: { shake: 0.05, punch: 3, boost: 0.4 },
    mega: { shake: 0.09, punch: 5, boost: 0.65 },
    ultra: { shake: 0.14, punch: 8, boost: 0.85 },
    jackpot: { shake: 0.22, punch: 12, boost: 1.0 },
  };

  // ---- 主循环 ----
  const clock = new THREE.Clock();
  let raf = 0;
  let disposed = false;
  let onFrame: ((now: number) => void) | null = null;
  const sunWorld = new THREE.Vector3(20, 32, -36);

  function loop(): void {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    const elapsed = clock.elapsedTime;

    buffalo.update(elapsed, dt);
    env.update(elapsed, dt, camera);

    // 黄昏过渡（免费旋转）
    duskK += (duskTarget - duskK) * Math.min(1, dt * 1.6);
    env.setDusk(duskK);
    (scene.fog as THREE.FogExp2).color.lerpColors(
      new THREE.Color("#dcc79b"),
      new THREE.Color("#c98d52"),
      duskK,
    );

    // 光感增强衰减
    boostK += (boostTarget - boostK) * Math.min(1, dt * 2.5);
    boostTarget *= Math.max(0, 1 - dt * 0.5);
    post?.setIntensityBoost(boostK);

    // 镜头：待机漂移 + 震屏 + 推镜
    shakeAmp *= Math.max(0, 1 - dt * 2.4);
    fovPunch *= Math.max(0, 1 - dt * 1.8);
    const driftX = Math.sin(elapsed * 0.18) * 0.35;
    const driftY = Math.sin(elapsed * 0.23) * 0.12;
    camera.position.set(
      camBase.x + driftX + (Math.random() - 0.5) * shakeAmp,
      camBase.y + driftY + (Math.random() - 0.5) * shakeAmp,
      camBase.z - fovPunch * 0.06,
    );
    camera.fov = 46 - fovPunch;
    camera.updateProjectionMatrix();
    camera.lookAt(0.4, 1.3 + duskK * 0.2, 0);

    if (post) {
      post.updateSunScreenPos(sunWorld, camera);
      post.composer.render();
    } else {
      renderer.render(scene, camera);
    }

    onFrame?.(performance.now());
  }
  loop();
  options.onReady?.();

  const handle = {
    playRun: () => buffalo.playRun(),    playRoar: () => {
      buffalo.playRoar();
      shakeAmp = Math.max(shakeAmp, 0.06);
    },
    playVictory: () => buffalo.playVictory(),
    celebrate: (tier) => {
      const fx = TIER_FX[tier];
      shakeAmp = Math.max(shakeAmp, fx.shake);
      fovPunch = Math.max(fovPunch, fx.punch);
      boostTarget = Math.max(boostTarget, fx.boost);
      if (tier === "jackpot" || tier === "ultra") buffalo.playVictory();
      else if (tier === "mega") buffalo.playRoar();
    },
    setFreeSpin: (on) => { duskTarget = on ? 1 : 0; },
    applyQuality: (next: QualityProfile) => {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, next.pixelRatio));
      env.setDensity(next.grassCount, next.treeCount, next.cloudCount);
      env.setGroundFog(next.enableGroundFog);
      buffalo.setFurShells(next.furShells);
      if (post) {
        post.setBloom(next.enableBloom);
        post.setGodRays(next.enableGodRays);
        post.setDof(next.enableDof);
      }
      resize();
    },
    setOnFrame: (cb) => { onFrame = cb; },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      buffalo.dispose();
      env.dispose();
      post?.dispose();
      renderer.dispose();
    },
  } satisfies Omit<SceneHandle, "onFrame">;
  Object.defineProperty(handle, "onFrame", {
    get: () => onFrame,
    set: (cb) => { onFrame = cb; },
  });
  return handle as SceneHandle;
}

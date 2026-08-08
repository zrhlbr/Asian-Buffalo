/**
 * Xi performance-quality — tier selection, DPR caps, degrade order, persistence.
 * Presentation only — no Wallet / Math / API contracts.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const {
  PIXEL_RATIO_CAPS,
  DEGRADE_ORDER,
  RENDER_SCALE_FLOOR,
  clarityPixelRatioFor,
  effectivePixelRatio,
  profileFor,
  scoreDevice,
  tierFromScore,
  detectInitialTier,
  resolveTier,
  normalizeSettings,
  defaultQualitySettings,
  applySettingsToProfile,
  withSoftRenderScale,
  FpsGovernor,
  stepDownTier,
} = await import("../client/m5/quality.ts");

test("DPR caps: ultra3 high2.5 mid2 low1.5 — never 1", () => {
  assert.equal(PIXEL_RATIO_CAPS.ultra, 3);
  assert.equal(PIXEL_RATIO_CAPS.high, 2.5);
  assert.equal(PIXEL_RATIO_CAPS.medium, 2);
  assert.equal(PIXEL_RATIO_CAPS.low, 1.5);
  assert.equal(clarityPixelRatioFor(3.5, "ultra"), 3);
  assert.equal(clarityPixelRatioFor(3, "high"), 2.5);
  assert.equal(clarityPixelRatioFor(2.5, "medium"), 2);
  assert.equal(clarityPixelRatioFor(2.5, "low"), 1.5);
  assert.equal(clarityPixelRatioFor(1, "low"), 1);
  assert.ok(profileFor("low").pixelRatio >= 1.5);
});

test("degrade order: particles→shadows→godRays→bloom→bg→renderScale", () => {
  assert.deepEqual([...DEGRADE_ORDER], [
    "particles",
    "shadows",
    "godRays",
    "bloom",
    "bgComplexity",
    "renderScale",
  ]);
  assert.equal(DEGRADE_ORDER[0], "particles");
  assert.equal(DEGRADE_ORDER.at(-1), "renderScale");
  assert.ok(!DEGRADE_ORDER.includes("symbolPlate"));
  assert.ok(!DEGRADE_ORDER.includes("hud"));
});

test("AUTO tier mapping from device score", () => {
  const weakPhone = {
    deviceMemory: 2,
    cores: 4,
    dpr: 3,
    width: 390,
    height: 844,
    gpuRenderer: "Mali-T720",
    maxTextureSize: 4096,
    webgl2: false,
    sampledFps: 28,
    mobile: true,
    smallScreen: true,
  };
  assert.equal(tierFromScore(scoreDevice(weakPhone), weakPhone), "low");

  const midPhone = {
    deviceMemory: 4,
    cores: 6,
    dpr: 2.5,
    width: 412,
    height: 915,
    gpuRenderer: "Adreno (TM) 619",
    maxTextureSize: 8192,
    webgl2: true,
    sampledFps: 45,
    mobile: true,
    smallScreen: true,
  };
  const midTier = tierFromScore(scoreDevice(midPhone), midPhone);
  assert.ok(midTier === "medium" || midTier === "high");

  const flagshipDesktop = {
    deviceMemory: 16,
    cores: 12,
    dpr: 1.5,
    width: 1920,
    height: 1080,
    gpuRenderer: "NVIDIA GeForce RTX 4070",
    maxTextureSize: 16384,
    webgl2: true,
    sampledFps: 60,
    mobile: false,
    smallScreen: false,
  };
  assert.equal(tierFromScore(scoreDevice(flagshipDesktop), flagshipDesktop), "ultra");

  assert.equal(resolveTier("high"), "high");
  assert.equal(resolveTier("ultra"), "ultra");
  assert.ok(["low", "medium", "high", "ultra"].includes(detectInitialTier()));
});

test("settings persistence normalize + FX/animal overlay", () => {
  const d = defaultQualitySettings();
  assert.equal(d.mode, "auto");
  assert.equal(d.fxEnabled, true);
  assert.equal(d.animalMode, "full");
  assert.equal(d.fpsTarget, "auto");

  const n = normalizeSettings({
    mode: "ultra",
    fxEnabled: false,
    animalMode: "simple",
    fpsTarget: 30,
  });
  assert.deepEqual(n, {
    mode: "ultra",
    fxEnabled: false,
    animalMode: "simple",
    fpsTarget: 30,
  });
  assert.equal(normalizeSettings({ mode: "nope" }).mode, "auto");

  const ultra = profileFor("ultra");
  const fxOff = applySettingsToProfile(ultra, {
    fxEnabled: false,
    animalMode: "full",
  });
  assert.equal(fxOff.enableBloom, false);
  assert.equal(fxOff.enableGodRays, false);
  assert.ok(fxOff.particleBudget <= 40);

  const simple = applySettingsToProfile(ultra, {
    fxEnabled: true,
    animalMode: "simple",
  });
  assert.equal(simple.furShells, 0);
});

test("FpsGovernor steps down under sustained <35 FPS; no bounce up", () => {
  const changes = [];
  const gov = new FpsGovernor(
    "ultra",
    (t) => changes.push(t),
    35,
    55,
    { sustainMs: 400, allowStepUp: false },
  );
  let now = 1000;
  for (let i = 0; i < 90; i++) {
    now += 40; // 25 FPS
    gov.tick(now);
  }
  assert.ok(changes.length >= 1);
  assert.equal(gov.current, "high");
  assert.equal(stepDownTier("high"), "medium");

  // After recovery to 60 FPS, must NOT bounce up (hysteresis)
  const before = gov.current;
  changes.length = 0;
  for (let i = 0; i < 120; i++) {
    now += 16;
    gov.tick(now);
  }
  assert.equal(gov.current, before);
  assert.equal(changes.length, 0);
});

test("soft renderScale only on low tier", () => {
  const high = withSoftRenderScale(profileFor("high"), 0.92);
  assert.equal(high.renderScale, 1);
  const low = withSoftRenderScale(profileFor("low"), 0.92);
  assert.equal(low.renderScale, RENDER_SCALE_FLOOR);
  assert.ok(
    effectivePixelRatio(3, "low", RENDER_SCALE_FLOOR) <=
      PIXEL_RATIO_CAPS.low * RENDER_SCALE_FLOOR + 0.001,
  );
});

test("profiles keep symbol clarity; low never kills anim entirely", () => {
  const low = profileFor("low");
  const ultra = profileFor("ultra");
  assert.ok(ultra.particleBudget > low.particleBudget);
  assert.ok(ultra.grassCount > low.grassCount);
  assert.equal(low.enableBloom, false);
  assert.equal(low.enableShadows, false);
  assert.ok(low.symbolAnimIntensity >= 1);
  assert.ok(low.transitionMs >= 200 && low.transitionMs <= 300);
  assert.ok(ultra.enableGodRays);
});

test("hero responsive assets exist (scaled from masters, not invented 4K)", () => {
  for (const name of [
    "journey-low.webp",
    "journey-mobile.webp",
    "journey-tablet.webp",
    "journey-desktop.webp",
    "bdk-low.webp",
    "bdk-mobile.webp",
    "bdk-tablet.webp",
    "bdk-desktop.webp",
  ]) {
    assert.ok(
      existsSync(join(root, "public/xi/heroes", name)),
      `missing ${name}`,
    );
  }
  assert.ok(existsSync(join(root, "public/xi/journey-hero.png")));
  assert.ok(existsSync(join(root, "public/xi/heroes/bull-demon-king.png")));
});

test("wiring: boot/hud/lobby extend quality; #gl translateZ preserved; no #hud shell translateZ", () => {
  const boot = read("client/m5/boot.ts");
  assert.match(boot, /FramePacer/);
  assert.match(boot, /applyDocumentTierAttrs/);
  assert.match(boot, /setAnimMode/);
  assert.match(boot, /allowStepUp:\s*false/);
  assert.match(boot, /pauseForBackground/);

  const hud = read("client/m5/ui/hud.ts");
  assert.match(hud, /setQualitySettings/);
  assert.match(hud, /data-fps/);

  const gc = read("app/game-client.tsx");
  assert.match(gc, /data-quality="ultra"/);
  assert.match(gc, /data-fx=/);
  assert.match(gc, /data-animal=/);

  const css = read("client/m5/styles.css");
  assert.match(css, /#gl\s*\{[^}]*translateZ\(0\)/s);
  assert.doesNotMatch(css, /#hud\s*\{[^}]*translateZ\(0\)/s);

  const lobbyQ = read("client/xi-lobby/quality.ts");
  assert.match(lobbyQ, /prefetchSlotAssets/);
  assert.match(lobbyQ, /heroSources/);

  const audio = read("client/m5/audio.ts");
  assert.match(audio, /setMaxConcurrentSfx/);
  assert.match(audio, /pauseForBackground/);
});

test("i18n quality keys present trilingual (m5 + lobby)", async () => {
  const m5 = await import("../client/m5/i18n.ts");
  assert.deepEqual(m5.validateDicts(), []);
  const m5src = read("client/m5/i18n.ts");
  for (const key of [
    "qualityUltra",
    "fxEffects",
    "animalSimple",
    "fpsTarget",
    "fps30",
  ]) {
    // zh-CN / en / my-MM each define the key once
    assert.equal(
      (m5src.match(new RegExp(`${key}:`, "g")) || []).length,
      3,
      key,
    );
  }
  const lobby = read("client/xi-lobby/i18n.ts");
  for (const key of [
    "lobby.quality.ultra",
    "lobby.quality.fx",
    "lobby.quality.animalSimple",
    "lobby.quality.fps30",
  ]) {
    assert.equal(
      (lobby.match(new RegExp(`"${key}"`, "g")) || []).length,
      3,
      key,
    );
  }
});

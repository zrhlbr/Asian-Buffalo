/**
 * M8 HD Clarity Upgrade V2 — presentation contracts.
 * Does not touch Wallet / Math / API / Grid / RTP.
 * Avoids importing symbols.ts (PNG ?url breaks bare node).
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
  RENDER_SCALE_BASE,
  RENDER_SCALE_FLOOR,
  DEGRADE_ORDER,
  clarityPixelRatioFor,
  effectivePixelRatio,
  profileFor,
  withSoftRenderScale,
} = await import("../client/m5/quality.ts");

const {
  NORMAL_SPIN_TOTAL_MS,
  SPIN_SPEED_MULT,
  NORMAL_REEL_STOP_MS,
} = await import("../client/m5/game/reel-timing.ts");

/** Mirror of reels.ts helpers — avoid importing reels (pulls PNG ?url). */
function pixelAlignWorldY(worldY, pixelsPerWorldUnit) {
  if (!(pixelsPerWorldUnit > 0) || !Number.isFinite(worldY)) return worldY;
  return Math.round(worldY * pixelsPerWorldUnit) / pixelsPerWorldUnit;
}
function settleSpinFrac(frac) {
  return Math.abs(frac) < 1e-4 ? 0 : frac;
}

const OFFICIAL = [
  "buffalo",
  "lion",
  "elephant",
  "antelope",
  "zebra",
  "wild",
  "scatter",
  "a",
  "k",
  "q",
  "j",
  "ten",
  "nine",
];

test("V2/V3 DPR caps: ultra≤3 high≤2.5 mid≤2 low≤1.5 — never low=1", () => {
  assert.equal(PIXEL_RATIO_CAPS.ultra, 3);
  assert.equal(PIXEL_RATIO_CAPS.high, 2.5);
  assert.equal(PIXEL_RATIO_CAPS.medium, 2);
  assert.equal(PIXEL_RATIO_CAPS.low, 1.5);
  assert.equal(clarityPixelRatioFor(3.5, "ultra"), 3);
  assert.equal(clarityPixelRatioFor(3, "high"), 2.5);
  assert.equal(clarityPixelRatioFor(3, "medium"), 2);
  assert.equal(clarityPixelRatioFor(2.5, "low"), 1.5);
  assert.equal(clarityPixelRatioFor(1, "low"), 1);
  assert.equal(profileFor("low").pixelRatio, 1.5);
});

test("V2 render scale: base 1; floor only on low soft-degrade", () => {
  assert.equal(RENDER_SCALE_BASE.high, 1);
  assert.equal(RENDER_SCALE_BASE.medium, 1);
  assert.equal(RENDER_SCALE_BASE.low, 1);
  assert.ok(RENDER_SCALE_FLOOR >= 0.9 && RENDER_SCALE_FLOOR < 1);
  const high = withSoftRenderScale(profileFor("high"), 0.92);
  assert.equal(high.renderScale, 1, "high must not soft-scale");
  const low = withSoftRenderScale(profileFor("low"), 0.92);
  assert.equal(low.renderScale, RENDER_SCALE_FLOOR);
  assert.equal(
    effectivePixelRatio(3, "low", RENDER_SCALE_FLOOR),
    1.5 * RENDER_SCALE_FLOOR,
  );
  assert.equal(effectivePixelRatio(3, "ultra", 1), 3);
});

test("V2 degrade order ends with renderScale; Symbol/HUD not first", () => {
  assert.deepEqual([...DEGRADE_ORDER], [
    "particles",
    "shadows",
    "godRays",
    "bloom",
    "bgComplexity",
    "renderScale",
  ]);
  assert.equal(DEGRADE_ORDER[DEGRADE_ORDER.length - 1], "renderScale");
  assert.ok(!DEGRADE_ORDER.includes("symbolPlate"));
  assert.ok(!DEGRADE_ORDER.includes("hud"));
});

test("V2 low quality keeps symbol plate 1024 and anim readable", () => {
  const low = profileFor("low");
  const symbols = read("client/m5/game/symbols.ts");
  assert.match(symbols, /const SIZE = 1024/);
  assert.match(symbols, /SYMBOL_TEXTURE_EXPECTATIONS/);
  assert.match(symbols, /nativeMaster:\s*1024/);
  assert.ok(low.symbolAnimIntensity >= 1, "low must not kill symbol life entirely");
  assert.equal(low.enableBloom, false);
  assert.equal(low.pixelRatio, 1.5);
  assert.equal(low.renderScale, 1);
});

test("V2 symbol runtime PNGs are native 1024 (not forced atlas-512)", () => {
  const symbols = read("client/m5/game/symbols.ts");
  assert.match(symbols, /const SIZE = 1024/);
  assert.match(symbols, /ASSET_SOURCE_LIMITATION|native master/i);
  assert.doesNotMatch(symbols, /symbols-atlas-512/);
  const dir = join(root, "client/m5/assets/symbols");
  assert.equal(OFFICIAL.length, 13);
  for (const id of OFFICIAL) {
    const png = join(dir, `${id}.png`);
    assert.ok(existsSync(png), `missing ${id}.png`);
    const buf = readFileSync(png);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    assert.equal(w, 1024, `${id} width`);
    assert.equal(h, 1024, `${id} height`);
  }
});

test("V2 reel pixel-align helpers + sharp restore window", () => {
  assert.equal(settleSpinFrac(0), 0);
  assert.equal(settleSpinFrac(1e-5), 0);
  assert.equal(settleSpinFrac(0.22), 0.22);
  assert.equal(pixelAlignWorldY(1.234, 100), 1.23);
  assert.equal(pixelAlignWorldY(1.235, 100), 1.24);
  const reels = read("client/m5/game/reels.ts");
  assert.match(reels, /pixelAlignWorldY/);
  assert.match(reels, /settleSpinFrac/);
  assert.match(reels, /sharpRestore/);
  assert.match(reels, /SHARP_RESTORE_SEC = 0\.15/);
  assert.match(reels, /REEL_SPIN_DIRECTION = \"down\"/);
});

test("V2 reel direction still down; ~6s timing contract", () => {
  assert.equal(NORMAL_SPIN_TOTAL_MS, 6_000);
  assert.equal(SPIN_SPEED_MULT, 1.35);
  assert.equal(NORMAL_REEL_STOP_MS[0], 4200);
  assert.equal(NORMAL_REEL_STOP_MS[4], 5800);
});

test("V2 world syncs composer DPR; bloom tighter; ACES retained", () => {
  const world = read("client/m5/scene/world.ts");
  assert.match(world, /composer\.setPixelRatio/);
  assert.match(world, /BLOOM_IDLE/);
  assert.match(world, /ACESFilmicToneMapping/);
  assert.match(world, /SRGBColorSpace/);
  assert.match(world, /getClarityProbe/);
  assert.match(world, /toneMappingExposure = 1\.02/);
  assert.match(world, /Math\.min\(0\.52/);
});

test("V2 game win bloom no longer washes at 0.78/0.9", async () => {
  const game = read("client/m5/game/game.ts");
  assert.doesNotMatch(game, /setBloom\(0\.78\)/);
  assert.doesNotMatch(game, /setBloom\(0\.9\)/);
  // Bloom strengths live in win-presentation choreography; world still caps ≤ 0.52
  const mod = await import("../client/m5/win-presentation.ts");
  for (const tier of mod.presentationTierOrder()) {
    if (tier === "none") continue;
    assert.ok(mod.choreographyFor(tier).bloom <= 0.52, `${tier} bloom`);
  }
  assert.ok(mod.choreographyFor("ultra").bloom >= 0.4);
  assert.ok(mod.choreographyFor("jackpot").bloom >= 0.48);
  const world = read("client/m5/scene/world.ts");
  assert.match(world, /Math\.min\(0\.52/);
});

test("V2 HUD CSS reduces soft text-shadow glow", () => {
  const css = read("client/m5/styles.css");
  assert.match(css, /-webkit-font-smoothing:\s*antialiased/);
  assert.match(css, /text-rendering:\s*geometricPrecision/);
  assert.doesNotMatch(css, /\.meter-value[^{]*\{[^}]*0 0 10px/);
});

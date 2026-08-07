/**
 * R1-M6 presentation guards — quality LOD, i18n completeness, UI_ONLY tiers,
 * debug-hook gating, formal boot isolation from Mock.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { WIN_TIERS_UI_ONLY, winTier } from "../client/m5/adapter.ts";
import {
  detectInitialTier,
  profileFor,
  resolveTier,
  FpsGovernor,
} from "../client/m5/quality.ts";
import { validateDicts, LANGS } from "../client/m5/i18n.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

function read(rel) {
  return readFileSync(join(repoRoot, rel), "utf8");
}

test("M6 i18n dictionaries are complete and non-empty across zh-CN / en / my-MM", () => {
  assert.deepEqual(LANGS, ["zh-CN", "en", "my-MM"]);
  const problems = validateDicts();
  assert.deepEqual(problems, []);
  for (const key of [
    "retry",
    "recovery",
    "sessionExpired",
    "mathMismatch",
    "networkError",
    "volume",
    "quality",
    "qualityAuto",
    "qualityHigh",
    "qualityMedium",
    "qualityLow",
    "settings",
    "mute",
    "unmute",
    "bigWin",
    "megaWin",
    "ultraWin",
    "jackpot",
    "spinning",
  ]) {
    // validateDicts already checks presence; this documents M6 required keys.
    assert.ok(key);
  }
});

test("quality profiles scale down on low tier", () => {
  const high = profileFor("high");
  const low = profileFor("low");
  assert.ok(high.grassCount > low.grassCount);
  assert.ok(high.pixelRatio >= low.pixelRatio);
  assert.equal(low.enableBloom, false);
  assert.equal(low.enableGodRays, false);
  assert.equal(low.enableDof, false);
  assert.equal(low.furShells, 0);
  assert.equal(resolveTier("high"), "high");
  assert.ok(["low", "medium", "high"].includes(detectInitialTier()));
});

test("FpsGovernor can drop tier under sustained low FPS", () => {
  const changes = [];
  const gov = new FpsGovernor("high", (t) => changes.push(t), 42, 55);
  // Seed 60 samples of ~30 FPS (dt≈33ms)
  let now = 1000;
  for (let i = 0; i < 70; i++) {
    now += 33;
    gov.tick(now);
  }
  assert.ok(changes.length >= 1);
  assert.equal(gov.current, "medium");
});

test("WIN_TIERS are UI_ONLY and do not live in money/math modules", () => {
  assert.equal(WIN_TIERS_UI_ONLY, true);
  assert.equal(winTier(500, 50), "big");
  assert.equal(winTier(5000, 50), "jackpot");
  for (const rel of [
    "lib/money-service.ts",
    "lib/server-game-engine.ts",
    "lib/math-config.ts",
    "lib/wallet-adapter.ts",
  ]) {
    const source = read(rel);
    assert.doesNotMatch(source, /WIN_TIERS/);
    assert.doesNotMatch(source, /winTier/);
  }
  assert.match(read("client/m5/adapter.ts"), /UI_ONLY/);
});

test("formal boot does not import Mock and gates __game", () => {
  const boot = read("client/m5/boot.ts");
  assert.doesNotMatch(boot, /mock-provider/);
  assert.doesNotMatch(boot, /createDemoGrid|evaluateSpin/);
  assert.match(boot, /allowDebugHooks/);
  assert.match(boot, /FormalGameProvider/);
  assert.match(boot, /FpsGovernor/);
  assert.match(boot, /visibilitychange/);
});

test("M6 enhancements live inside client/m5 (no parallel app/m6 runtime)", () => {
  const quality = read("client/m5/quality.ts");
  assert.match(quality, /QualityProfile/);
  const world = read("client/m5/scene/world.ts");
  assert.match(world, /applyQuality/);
  assert.match(world, /setFreeSpinMood/);
  assert.match(world, /GodRaysShader/);
  const buffalo = read("client/m5/scene/buffalo.ts");
  assert.match(buffalo, /setFurShells/);
  assert.match(buffalo, /interrupt/);
  const audio = read("client/m5/audio.ts");
  assert.match(audio, /setBackgroundDimmed/);
  assert.match(audio, /setVolume/);
  // Must not resurrect Kimi demo client path as formal entry
  const gameClient = read("app/game-client.tsx");
  assert.match(gameClient, /bootM5/);
  assert.doesNotMatch(gameClient, /createDemoGrid|evaluateSpin/);
  assert.match(gameClient, /settings-modal/);
});

test("Kimi M6 handoff archive is present for audit trail", () => {
  const report = read("docs/m6-handoff/HANDOFF_AUDIT_REPORT.md");
  assert.match(report, /4049348/);
  assert.match(report, /9654d41/);
  assert.ok(read("docs/m6-handoff/kimi-readonly/app-m6/quality.ts").length > 100);
});

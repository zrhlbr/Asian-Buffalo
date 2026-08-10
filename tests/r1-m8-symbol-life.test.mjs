/**
 * R1-M8 — Symbol life / FX presentation contracts.
 * Animation layer must never mutate Formal spin / grid / wallet.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

test("animal symbol life module covers all formal animal IDs", async () => {
  const mod = await import("../client/m5/game/symbol-life.ts");
  const animals = [...mod.ANIMAL_SYMBOLS].sort();
  assert.deepEqual(animals, ["antelope", "buffalo", "elephant", "lion", "zebra"].sort());
  for (const id of animals) {
    assert.equal(mod.isAnimalSymbol(id), true);
    assert.equal(mod.symbolAnimKind(id), "animal");
  }
  assert.equal(mod.symbolAnimKind("wild"), "wild");
  assert.equal(mod.symbolAnimKind("scatter"), "scatter");
  assert.equal(mod.symbolAnimKind("a"), "letter");
  const feats = mod.symbolLifeShaderFeatures();
  for (const f of ["breath", "blink", "gaze", "wild-sweep", "scatter-sun", "win-rim"]) {
    assert.ok(feats.includes(f), `missing feature ${f}`);
  }
});

test("reels use symbol-life shaders and keep downward spin direction", () => {
  const reels = read("client/m5/game/reels.ts");
  assert.match(reels, /createSymbolMaterial/);
  assert.match(reels, /updateSymbolLife/);
  assert.match(reels, /setSymbolAnimIntensity/);
  assert.match(reels, /REEL_SPIN_DIRECTION = "down"/);
  assert.match(reels, /cellY\(r, frac\)/);
  assert.doesNotMatch(reels, /Math\.random\(\).*grid/);
});

test("buffalo exposes idle / roar / victory / bigWin / jackpot contracts", () => {
  const src = read("client/m5/scene/buffalo.ts");
  assert.match(src, /roar\(\): void/);
  assert.match(src, /victory\(\): void/);
  assert.match(src, /bigWin\(\): void/);
  assert.match(src, /jackpot\(\): void/);
  assert.match(src, /interrupt\(\): void/);
  assert.match(src, /breathMist/);
  assert.match(src, /"jackpot"/);
  assert.match(src, /animationContract/);
});

test("win FX and animal cues stay presentation-only in Game", () => {
  const game = read("client/m5/game/game.ts");
  assert.match(game, /playWinSymbolCues/);
  assert.match(game, /audio\.animalCue/);
  assert.match(game, /buffalo\.jackpot\(\)/);
  assert.match(game, /collectWinCells/);
  assert.match(game, /this\.provider/);
  assert.doesNotMatch(game, /writeBalance|mutateGrid|localWin|recomputeWins/);
  // Highlights use server grid only
  assert.match(game, /highlightCells\(cells, result\.grid\)/);
});

test("quality tiers expose symbolAnimIntensity without lowering DPR clarity", async () => {
  const { profileFor } = await import("../client/m5/quality.ts");
  const high = profileFor("high");
  const medium = profileFor("medium");
  const low = profileFor("low");
  assert.equal(high.symbolAnimIntensity, 2);
  assert.ok(medium.symbolAnimIntensity >= 1);
  assert.ok(low.symbolAnimIntensity >= 1);
  assert.ok(low.pixelRatio >= 2);
  assert.ok(high.pixelRatio >= medium.pixelRatio);
});

test("boot wires symbol anim intensity and Formal provider only", () => {
  const boot = read("client/m5/boot.ts");
  assert.match(boot, /setSymbolAnimIntensity/);
  assert.match(boot, /FormalGameProvider/);
  assert.doesNotMatch(boot, /MockGameProvider/);
});

test("audio animal cues are fail-soft", () => {
  const audio = read("client/m5/audio.ts");
  assert.match(audio, /animalCue\(/);
  assert.match(audio, /audio failure must never block spins/);
  assert.match(audio, /setBackgroundDimmed/);
});

test("symbol-life and reels do not import formal money cores", () => {
  const life = read("client/m5/game/symbol-life.ts");
  const reels = read("client/m5/game/reels.ts");
  for (const src of [life, reels]) {
    assert.doesNotMatch(src, /from ["'].*formal-provider/);
    assert.doesNotMatch(src, /from ["'].*wallet/);
    assert.doesNotMatch(src, /from ["'].*ledger/);
    assert.doesNotMatch(src, /from ["'].*paytable/);
  }
});

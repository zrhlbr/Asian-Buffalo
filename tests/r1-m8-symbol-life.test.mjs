/**
 * R1-M8 — Symbol life / animal-life v2 presentation contracts.
 * Animation layer must never mutate Formal spin / grid / wallet.
 * Tiles must stay on MeshBasicMaterial (ShaderMaterial path was invisible).
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";

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
  const feats = mod.symbolLifeFeatures();
  for (const f of [
    "breath",
    "blink",
    "gaze",
    "species-profiles",
    "desync-accents",
    "wild-metal",
    "scatter-sun",
    "meshbasic-visible",
    "lod-buffalo-keep",
  ]) {
    assert.ok(feats.includes(f), `missing feature ${f}`);
  }
});

test("species profiles differ and lion forbids buffalo-style nod", async () => {
  const mod = await import("../client/m5/game/symbol-life.ts");
  const ids = ["buffalo", "lion", "elephant", "zebra", "antelope", "wild", "scatter"];
  const fps = ids.map((id) => mod.speciesBehaviorFingerprint(id));
  assert.equal(new Set(fps).size, fps.length, "species fingerprints must be unique");

  const buffalo = mod.speciesProfile("buffalo");
  const lion = mod.speciesProfile("lion");
  const elephant = mod.speciesProfile("elephant");
  const zebra = mod.speciesProfile("zebra");
  const antelope = mod.speciesProfile("antelope");

  assert.equal(buffalo.allowNod, true);
  assert.ok(buffalo.accents.includes("nod"));
  assert.ok(buffalo.accents.includes("snort"));
  assert.equal(buffalo.winAccent, "headUp");

  assert.equal(lion.allowNod, false);
  assert.ok(!lion.accents.includes("nod"), "lion must not buffalo-nod");
  assert.ok(lion.accents.includes("mane"));
  assert.equal(lion.winAccent, "growl");

  assert.equal(elephant.winAccent, "trunkRaise");
  assert.ok(elephant.swayAmp > buffalo.swayAmp || elephant.accents.includes("ear"));

  assert.ok(zebra.accents.includes("tail"));
  assert.ok(zebra.accents.includes("toss"));

  assert.equal(antelope.allowNod, true);
  assert.equal(antelope.winAccent, "headUp");

  assert.equal(mod.speciesProfile("wild").tintMode, "metal");
  assert.equal(mod.speciesProfile("scatter").tintMode, "sun");
});

test("per-cell phase/seed diverge so accents are not synchronized", async () => {
  const mod = await import("../client/m5/game/symbol-life.ts");
  const phases = new Set();
  const seeds = new Set();
  for (let reel = 0; reel < 5; reel++) {
    for (let cell = 0; cell < 6; cell++) {
      phases.add(mod.symbolPhase(reel, cell).toFixed(5));
      seeds.add(mod.symbolSeed(reel, cell).toFixed(5));
    }
  }
  assert.ok(phases.size >= 25, `expected desynced phases, got ${phases.size}`);
  assert.ok(seeds.size >= 25, `expected desynced seeds, got ${seeds.size}`);
  assert.notEqual(mod.symbolPhase(0, 0), mod.symbolPhase(1, 0));
  assert.notEqual(mod.symbolSeed(0, 0), mod.symbolSeed(0, 1));
});

test("LOD reduces intensity but never fully disables buffalo", async () => {
  const mod = await import("../client/m5/game/symbol-life.ts");
  assert.equal(mod.lifeIntensityForSymbol("buffalo", 0), 1);
  assert.equal(mod.lifeIntensityForSymbol("buffalo", 1), 1);
  assert.equal(mod.lifeIntensityForSymbol("buffalo", 2), 2);
  assert.equal(mod.lifeIntensityForSymbol("lion", 0), 0);
  assert.equal(mod.lifeIntensityForSymbol("lion", 1), 1);
  assert.equal(mod.lifeIntensityForSymbol("letter", 2), 0);
  assert.ok(mod.accentIntervalScale(1) > mod.accentIntervalScale(2));
  assert.ok(mod.accentIntervalScale(0) > mod.accentIntervalScale(1));
});

test("createSymbolMaterial stays MeshBasicMaterial (visible path)", async () => {
  const mod = await import("../client/m5/game/symbol-life.ts");
  const tex = new THREE.Texture();
  const mat = mod.createSymbolMaterial(tex, "animal", 0.5, "buffalo", 0.12);
  assert.ok(mat instanceof THREE.MeshBasicMaterial);
  assert.equal(mat.type, "MeshBasicMaterial");
  assert.ok(mod.isVisibleTileMaterial(mat));
  assert.ok(!(mat instanceof THREE.ShaderMaterial));

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  const x0 = mesh.position.x;
  mod.updateSymbolLife(mat, {
    time: 1.25,
    opacity: 1,
    win: 0,
    intensity: 2,
    spinning: 0,
    symbolId: "buffalo",
    mesh,
    baseScaleX: 1,
    baseScaleY: 1,
    basePosY: 0,
  });
  assert.equal(mat.opacity, 1);
  assert.ok(mat.color.r > 0.5, "idle tint must keep tile bright/visible");
  // Life may offset x via look — must remain finite & recognition-safe
  assert.ok(Number.isFinite(mesh.position.x));
  assert.ok(Math.abs(mesh.position.x - x0) < 0.08);

  mod.triggerSymbolWinAccent(mat, 1.4);
  mod.updateSymbolLife(mat, {
    time: 1.26,
    opacity: 1,
    win: 1.4,
    intensity: 2,
    spinning: 0,
    symbolId: "lion",
    mesh,
    baseScaleX: 1,
    baseScaleY: 1,
    basePosY: 0,
  });
  assert.ok(mat.opacity > 0.9);
});

test("reels wire species life and keep downward spin direction", () => {
  const reels = read("client/m5/game/reels.ts");
  assert.match(reels, /createSymbolMaterial/);
  assert.match(reels, /updateSymbolLife/);
  assert.match(reels, /triggerSymbolWinAccent/);
  assert.match(reels, /lifeSpeciesOf/);
  assert.match(reels, /symbolSeed/);
  assert.match(reels, /setSymbolAnimIntensity/);
  assert.match(reels, /REEL_SPIN_DIRECTION = "down"/);
  assert.match(reels, /cellY\(r, frac\)/);
  assert.doesNotMatch(reels, /new THREE\.ShaderMaterial/);
  assert.doesNotMatch(reels, /Math\.random\(\).*grid/);
});

test("symbol-life source forbids reel ShaderMaterial tiles", () => {
  const life = read("client/m5/game/symbol-life.ts");
  assert.match(life, /MeshBasicMaterial/);
  assert.match(life, /SPECIES_PROFILES/);
  assert.match(life, /allowNod: false/);
  assert.match(life, /winAccent: "growl"/);
  assert.match(life, /winAccent: "trunkRaise"/);
  // Must not construct ShaderMaterial for tiles in this module
  assert.doesNotMatch(life, /new THREE\.ShaderMaterial/);
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
  assert.match(src, /charge\(\): void/);
});

test("win FX and animal cues stay presentation-only in Game", () => {
  const game = read("client/m5/game/game.ts");
  assert.match(game, /playWinSymbolCues/);
  assert.match(game, /audio\.animalCue/);
  assert.match(game, /buffalo\.(breakReel|jackpot)\(\)/);
  assert.match(game, /collectWinCells/);
  assert.match(game, /this\.provider/);
  assert.doesNotMatch(game, /writeBalance|mutateGrid|localWin|recomputeWins/);
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

test("reel timing contract still NORMAL_SPIN_TOTAL_MS = 6000", () => {
  const timing = read("client/m5/game/reel-timing.ts");
  assert.match(timing, /NORMAL_SPIN_TOTAL_MS\s*=\s*6_?000/);
});

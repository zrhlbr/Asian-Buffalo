import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

test("M8 reel rig is full-bleed (centered, dynamic scale, no side offset)", () => {
  const reels = read("client/m5/game/reels.ts");
  assert.match(reels, /setAspect\(/);
  assert.match(reels, /scaleFactor/);
  assert.match(reels, /sidePadPx|padRatio/);
  assert.match(reels, /measureScreenFill/);
  assert.match(reels, /Always center|position\.x = 0/);
  assert.doesNotMatch(reels, /position\.set\(0\.9/);
  assert.match(reels, /scaledFrameHalfWidth/);
});

test("M8 camera framing syncs to scaled reel frame + punch zoom", () => {
  const world = read("client/m5/scene/world.ts");
  assert.match(world, /setFrameHalfWidth/);
  assert.match(world, /punchZoom/);
  assert.match(world, /applyCommercialFov/);
  assert.match(world, /heatHaze|heat haze/i);
  const boot = read("client/m5/boot.ts");
  assert.match(boot, /setFrameHalfWidth/);
  assert.match(boot, /readSidePadPx|sidePad/);
  assert.match(boot, /setHomeLayout/);
  const game = read("client/m5/game/game.ts");
  assert.match(game, /punchZoom/);
});

test("M8 shell marks commercial full-bleed class and preserves Hud IDs", () => {
  const shell = read("app/game-client.tsx");
  assert.match(shell, /m8-commercial/);
  for (const id of ["balance", "win", "bet", "btn-spin", "celebration", "loading"]) {
    assert.match(shell, new RegExp(`id="${id}"`));
  }
});

test("M8 does not introduce demo math / Mock on formal client path", () => {
  const shell = read("app/game-client.tsx");
  assert.match(shell, /bootM5/);
  assert.doesNotMatch(shell, /createDemoGrid|evaluateSpin/);
  const boot = read("client/m5/boot.ts");
  assert.match(boot, /FormalGameProvider/);
  assert.doesNotMatch(boot, /MockGameProvider|createDemoGrid/);
});

test("M8 commercial symbol plate unifies rim light", () => {
  const symbols = read("client/m5/game/symbols.ts");
  assert.match(symbols, /warm key-light wash|key-light/);
  assert.match(symbols, /outer specular rim|specular rim/);
  assert.match(symbols, /drawBuffaloSymbol/);
  assert.match(symbols, /M8 commercial 3D symbols|warm key-light wash/);
  assert.ok(existsSync(join(root, "client/m5/assets/symbols/buffalo.png")));
  assert.ok(existsSync(join(root, "docs/m8-review/symbols/buffalo-1024.png")));
  assert.ok(existsSync(join(root, "docs/m8-review/symbols/symbols-atlas-512.webp")));
  for (const id of ["wild", "scatter", "elephant", "lion", "zebra", "antelope", "a", "k", "q", "j", "ten", "nine"]) {
    assert.ok(existsSync(join(root, "client/m5/assets/symbols", `${id}.png`)), id);
    assert.ok(existsSync(join(root, "docs/m8-review/symbols", `${id}-512.webp`)), `${id} webp`);
  }
});

test("M8 Phase2 buffalo has bigWin action + interruptible states", () => {
  const buffalo = read("client/m5/scene/buffalo.ts");
  assert.match(buffalo, /bigWin\(\)/);
  assert.match(buffalo, /case \"bigWin\"/);
  assert.match(buffalo, /interrupt\(\)/);
  assert.match(buffalo, /breathMistT|puffSmoke/);
  const game = read("client/m5/game/game.ts");
  assert.match(game, /buffalo\.bigWin\(\)/);
});

test("M8 i18n includes session key in all locales", () => {
  const i18n = read("client/m5/i18n.ts");
  assert.match(i18n, /session:\s*"会话"/);
  assert.match(i18n, /session:\s*"Session"/);
  assert.match(i18n, /session:\s*"ဆက်ရှင်"/);
});

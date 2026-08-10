import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

test("Phase3 symbol plate is 1024 (not 512 downscale)", () => {
  const symbols = read("client/m5/game/symbols.ts");
  assert.match(symbols, /const SIZE = 1024/);
  assert.match(symbols, /LinearMipmapLinearFilter/);
  assert.match(symbols, /setSymbolMaxAnisotropy/);
  assert.match(symbols, /imageSmoothingQuality = \"high\"/);
});

test("Phase3 quality keeps high DPR on low/medium (never DPR 1 for clarity)", () => {
  const q = read("client/m5/quality.ts");
  assert.match(q, /pixelRatio: 3/); // high
  assert.match(q, /pixelRatio: 2/); // medium + low
  assert.doesNotMatch(q, /low:\s*\{[^}]*pixelRatio: 1/);
  assert.match(q, /enableDof: false/);
});

test("Phase3 renderer always antialiases and uses clarity DPR helper", () => {
  const world = read("client/m5/scene/world.ts");
  assert.match(world, /antialias: true/);
  assert.match(world, /clarityPixelRatio/);
  assert.match(world, /setSymbolMaxAnisotropy/);
  assert.match(world, /ACESFilmicToneMapping/);
  assert.match(world, /SRGBColorSpace/);
});

test("Phase3 HUD font sharpness CSS present", () => {
  const css = read("client/m5/styles.css");
  assert.match(css, /-webkit-font-smoothing:\s*antialiased/);
  assert.match(css, /text-rendering:\s*geometricPrecision/);
});

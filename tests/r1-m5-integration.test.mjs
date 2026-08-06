/**
 * R1-M5 integration guards — formal presentation path, no mock on boot,
 * UI tiers isolated, DEV identity fail-closed by default.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createRuntimeIdentityProvider,
  DevTestIdentityProvider,
  isDevTestIdentityEnabled,
} from "../lib/runtime-identity.ts";
import {
  createProductionIdentityProvider,
  UnconfiguredIdentityProvider,
} from "../lib/identity.ts";
import { winTier } from "../client/m5/adapter.ts";
import {
  FORMAL_SYMBOLS,
  LINES,
  REELS,
  ROWS,
} from "../client/m5/adapter.ts";
import { PAYLINE_COUNT, GRID_COLUMNS, GRID_ROWS, SYMBOLS } from "../lib/game-config.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

function read(rel) {
  return readFileSync(join(repoRoot, rel), "utf8");
}

test("formal grid is 5×4 with 50 lines and formal SymbolId set", () => {
  assert.equal(REELS, 5);
  assert.equal(ROWS, 4);
  assert.equal(LINES, 50);
  assert.equal(GRID_COLUMNS, 5);
  assert.equal(GRID_ROWS, 4);
  assert.equal(PAYLINE_COUNT, 50);
  for (const id of [
    "buffalo",
    "lion",
    "elephant",
    "zebra",
    "antelope",
    "a",
    "k",
    "q",
    "j",
    "ten",
    "nine",
    "wild",
    "scatter",
  ]) {
    assert.ok(FORMAL_SYMBOLS.includes(id), `missing ${id}`);
    assert.ok(SYMBOLS[id], `game-config missing ${id}`);
  }
  assert.ok(!FORMAL_SYMBOLS.includes("eagle"));
  assert.ok(!FORMAL_SYMBOLS.includes("lotus"));
});

test("boot path uses FormalGameProvider and never imports MockProvider", () => {
  const boot = read("client/m5/boot.ts");
  const gameClient = read("app/game-client.tsx");
  // Strip block comments so documentation mentions do not trip import guards.
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const bootCode = stripComments(boot);
  const clientCode = stripComments(gameClient);
  assert.match(bootCode, /FormalGameProvider/);
  assert.doesNotMatch(bootCode, /MockProvider/);
  assert.doesNotMatch(bootCode, /mock-provider/);
  assert.doesNotMatch(bootCode, /adapter\.legacy-mock/);
  assert.doesNotMatch(clientCode, /createDemoGrid/);
  assert.doesNotMatch(clientCode, /evaluateSpin/);
  assert.doesNotMatch(clientCode, /MockProvider/);
  assert.match(clientCode, /bootM5|client\/m5\/boot/);
});

test("formal provider talks Session/Spin/Round/Rules/Balance APIs", () => {
  const source = read("client/m5/formal-provider.ts");
  assert.match(source, /\/api\/v1\/game\/sessions/);
  assert.match(source, /\/api\/v1\/game\/spins/);
  assert.match(source, /\/api\/v1\/game\/rounds\//);
  assert.match(source, /\/api\/v1\/game\/rules\//);
  assert.match(source, /\/api\/v1\/game\/wallet\/balance/);
  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /PAYTABLE/);
  assert.doesNotMatch(source, /evaluate\(/);
});

test("winTier is UI-only and does not appear in money/math modules", () => {
  assert.equal(winTier(500, 50), "big");
  assert.equal(winTier(1250, 50), "mega");
  assert.equal(winTier(2500, 50), "ultra");
  assert.equal(winTier(5000, 50), "jackpot");
  assert.equal(winTier(49, 50), "none");

  for (const rel of [
    "lib/spin-orchestrator.ts",
    "lib/wallet-adapter.ts",
    "lib/db-ledger.ts",
    "lib/money-service.ts",
    "lib/server-game-engine.ts",
    "lib/round-service.ts",
  ]) {
    const source = read(rel);
    assert.doesNotMatch(source, /winTier/);
    assert.doesNotMatch(source, /WIN_TIERS/);
  }
});

test("runtime identity fails closed without explicit AB_ALLOW_TEST_IDENTITY=1", () => {
  const prevAllow = process.env.AB_ALLOW_TEST_IDENTITY;
  const prevForce = process.env.AB_FORCE_FAIL_CLOSED_IDENTITY;
  try {
    delete process.env.AB_ALLOW_TEST_IDENTITY;
    delete process.env.AB_FORCE_FAIL_CLOSED_IDENTITY;
    assert.equal(isDevTestIdentityEnabled(), false);
    assert.ok(createRuntimeIdentityProvider() instanceof UnconfiguredIdentityProvider);
    assert.ok(createProductionIdentityProvider() instanceof UnconfiguredIdentityProvider);

    // Explicit opt-in only — tests inject the variable themselves.
    process.env.AB_ALLOW_TEST_IDENTITY = "1";
    assert.equal(isDevTestIdentityEnabled(), true);
    assert.ok(createRuntimeIdentityProvider() instanceof DevTestIdentityProvider);
  } finally {
    if (prevAllow === undefined) delete process.env.AB_ALLOW_TEST_IDENTITY;
    else process.env.AB_ALLOW_TEST_IDENTITY = prevAllow;
    if (prevForce === undefined) delete process.env.AB_FORCE_FAIL_CLOSED_IDENTITY;
    else process.env.AB_FORCE_FAIL_CLOSED_IDENTITY = prevForce;
  }
});

test("M5 client assets live inside formal repo (no dual frontend dependency)", () => {
  const required = [
    "client/m5/boot.ts",
    "client/m5/formal-provider.ts",
    "client/m5/adapter.ts",
    "client/m5/styles.css",
    "client/m5/audio.ts",
    "client/m5/i18n.ts",
    "client/m5/game/game.ts",
    "client/m5/game/reels.ts",
    "client/m5/game/symbols.ts",
    "client/m5/scene/world.ts",
    "client/m5/scene/buffalo.ts",
    "client/m5/scene/particles.ts",
    "client/m5/ui/hud.ts",
  ];
  for (const rel of required) {
    assert.ok(read(rel).length > 0, rel);
  }
  // Trilingual keys present
  const i18n = read("client/m5/i18n.ts");
  assert.match(i18n, /zh-CN/);
  assert.match(i18n, /my-MM/);
  assert.match(i18n, /"en"/);
  assert.match(i18n, /50/);
});

test("frozen M1-M4 money/math files were not rewritten by M5 integration", () => {
  // Spot-check: M4 commit markers / exports still present and M5 did not add winTier.
  const money = read("lib/money-service.ts");
  assert.match(money, /class MoneyService/);
  const ledger = read("lib/db-ledger.ts");
  assert.match(ledger, /MemoryLedger|class /);
  const math = read("lib/math-config.ts");
  assert.match(math, /MathVersionConfig/);
});

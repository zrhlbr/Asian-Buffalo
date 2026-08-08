/**
 * R1-M8 — Commercial win presentation ladder (UI_ONLY).
 * Must not alter spin timing, reel direction, grid authority, or money modules.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function mockResult(partial) {
  return {
    roundId: "t",
    grid: partial.grid ?? [
      ["a", "a", "a", "a"],
      ["k", "k", "k", "k"],
      ["q", "q", "q", "q"],
      ["j", "j", "j", "j"],
      ["ten", "ten", "ten", "ten"],
    ],
    winMinor: partial.winMinor ?? 0,
    totalBetMinor: partial.totalBetMinor ?? 50,
    balanceAfterMinor: 1000,
    lineWins: partial.lineWins ?? [],
    winningPositions: partial.winningPositions ?? [],
    scatterCount: partial.scatterCount ?? 0,
    scatterWin: 0,
    freeGamesRemaining: partial.freeGamesRemaining ?? 0,
    awardedFreeGames: partial.awardedFreeGames ?? 0,
    isFreeGame: false,
    mathVersion: "test",
  };
}

test("presentation tier order includes Super/Epic between Ultra and Jackpot", async () => {
  const mod = await import("../client/m5/win-presentation.ts");
  const order = [...mod.presentationTierOrder()];
  const ultra = order.indexOf("ultra");
  const superI = order.indexOf("super");
  const epic = order.indexOf("epic");
  const jackpot = order.indexOf("jackpot");
  assert.ok(ultra > 0);
  assert.equal(superI, ultra + 1);
  assert.equal(epic, superI + 1);
  assert.equal(jackpot, epic + 1);
  assert.equal(mod.assertMultiplierBandOrder(), true);
});

test("winTier multiplier bands keep Big/Mega/Ultra and insert Super/Epic", async () => {
  const { winTier, WIN_TIERS } = await import("../client/m5/adapter.ts");
  assert.equal(winTier(500, 50), "big"); // 10x
  assert.equal(winTier(1250, 50), "mega"); // 25x
  assert.equal(winTier(2500, 50), "ultra"); // 50x
  assert.equal(winTier(3500, 50), "super"); // 70x
  assert.equal(winTier(4250, 50), "epic"); // 85x
  assert.equal(winTier(5000, 50), "jackpot"); // 100x
  assert.ok(WIN_TIERS.ultra < WIN_TIERS.super);
  assert.ok(WIN_TIERS.super < WIN_TIERS.epic);
  assert.ok(WIN_TIERS.epic < WIN_TIERS.jackpot);
});

test("resolvePresentationTier maps line length and fullscreen animals", async () => {
  const mod = await import("../client/m5/win-presentation.ts");
  assert.equal(
    mod.resolvePresentationTier(
      mockResult({
        winMinor: 30,
        lineWins: [{ line: 1, symbol: "a", count: 3, payout: 30 }],
      }),
    ),
    "normal",
  );
  assert.equal(
    mod.resolvePresentationTier(
      mockResult({
        winMinor: 80,
        lineWins: [{ line: 1, symbol: "k", count: 4, payout: 80 }],
      }),
    ),
    "medium",
  );
  assert.equal(
    mod.resolvePresentationTier(
      mockResult({
        winMinor: 120,
        lineWins: [{ line: 1, symbol: "q", count: 5, payout: 120 }],
      }),
    ),
    "strong",
  );

  const zebraGrid = Array.from({ length: 5 }, () => ["zebra", "zebra", "a", "k"]);
  assert.equal(
    mod.resolvePresentationTier(
      mockResult({
        winMinor: 200,
        grid: zebraGrid,
        lineWins: [{ line: 1, symbol: "zebra", count: 5, payout: 200 }],
      }),
    ),
    "fullscreen_common",
  );

  const lionGrid = Array.from({ length: 5 }, () => ["lion", "lion", "a", "k"]);
  assert.equal(
    mod.resolvePresentationTier(
      mockResult({
        winMinor: 220,
        grid: lionGrid,
        lineWins: [{ line: 1, symbol: "lion", count: 5, payout: 220 }],
      }),
    ),
    "fullscreen_high",
  );

  const buffaloGrid = Array.from({ length: 5 }, () => [
    "buffalo",
    "buffalo",
    "buffalo",
    "a",
  ]);
  assert.equal(
    mod.resolvePresentationTier(
      mockResult({
        winMinor: 300,
        grid: buffaloGrid,
        lineWins: [{ line: 1, symbol: "buffalo", count: 5, payout: 300 }],
      }),
    ),
    "fullscreen_buffalo",
  );

  // Multiplier band wins over line length
  assert.equal(
    mod.resolvePresentationTier(
      mockResult({
        winMinor: 5000,
        lineWins: [{ line: 1, symbol: "a", count: 3, payout: 5000 }],
      }),
    ),
    "jackpot",
  );
});

test("choreography is data-driven and distinct per tier", async () => {
  const mod = await import("../client/m5/win-presentation.ts");
  const seenAudio = new Set();
  for (const tier of mod.presentationTierOrder()) {
    if (tier === "none") continue;
    const c = mod.choreographyFor(tier);
    assert.equal(c.tier, tier);
    assert.ok(c.audio.length > 0, `${tier} needs audio`);
    for (const a of c.audio) seenAudio.add(a);
  }
  // Must not collapse all tiers to one cue
  assert.ok(seenAudio.size >= 8, `expected distinct cues, got ${seenAudio.size}`);
  assert.ok(mod.FREE_SPIN_ENTER_CHOREO.audio.includes("freeSpinEnter"));
  assert.equal(mod.FREE_SPIN_ENTER_CHOREO.buffalo, "roar");
});

test("Game wires presentation resolver + free-spin enter hooks", () => {
  const game = read("client/m5/game/game.ts");
  assert.match(game, /resolvePresentationOutcome|resolvePresentationTier/);
  assert.match(game, /presentFreeSpinEnter|FREE_SPIN_ENTER_CHOREO/);
  assert.match(game, /applyChoreography/);
  assert.match(game, /playCue/);
  assert.doesNotMatch(game, /writeBalance|mutateGrid|localWin|recomputeWins/);
  assert.match(game, /this\.provider/);
});

test("spin timing contract (~6s normal, turbo independent)", async () => {
  const timing = await import("../client/m5/game/reel-timing.ts");
  assert.equal(timing.NORMAL_SPIN_TOTAL_MS, 6_000);
  assert.deepEqual([...timing.NORMAL_REEL_STOP_MS], [4200, 4600, 5000, 5400, 5800]);
  assert.equal(timing.TURBO_SPIN_TOTAL_MS, 2500);
  const reels = read("client/m5/game/reels.ts");
  assert.match(reels, /REEL_SPIN_DIRECTION = "down"/);
  assert.match(reels, /NORMAL_SPIN_TOTAL_MS|spinTimingProfile|reel-timing/);
});

test("reel direction remains down and grid is never locally authored in Game", () => {
  const reels = read("client/m5/game/reels.ts");
  assert.match(reels, /REEL_SPIN_DIRECTION = "down"/);
  assert.match(reels, /cellY\(r, frac\)/);
  const game = read("client/m5/game/game.ts");
  assert.match(game, /result\.grid/);
  assert.match(game, /spinAll\(result\.grid/);
  assert.doesNotMatch(game, /createDemoGrid|evaluateSpin/);
});

test("win presentation stays out of money / math / spin server modules", () => {
  for (const rel of [
    "lib/spin-orchestrator.ts",
    "lib/wallet-adapter.ts",
    "lib/db-ledger.ts",
    "lib/money-service.ts",
    "lib/server-game-engine.ts",
    "lib/round-service.ts",
  ]) {
    const source = read(rel);
    assert.doesNotMatch(source, /resolvePresentationTier/);
    assert.doesNotMatch(source, /PRESENTATION_TIER_ORDER/);
    assert.doesNotMatch(source, /TIER_CHOREOGRAPHY/);
    assert.doesNotMatch(source, /superWin|epicWin/);
  }
});

test("audio exposes distinct tier methods (no shared mega→big collapse)", () => {
  const audio = read("client/m5/audio.ts");
  for (const fn of [
    "winNormal",
    "winMedium",
    "winStrong",
    "fullscreenCommon",
    "fullscreenHigh",
    "fullscreenBuffalo",
    "bigWin",
    "megaWin",
    "ultraWin",
    "superWin",
    "epicWin",
    "jackpot",
    "freeSpinEnter",
    "playCue",
  ]) {
    assert.match(audio, new RegExp(`${fn}\\(`));
  }
  // mega/ultra/jackpot must not simply call bigWin()
  assert.doesNotMatch(audio, /megaWin\(\): void \{\s*this\.bigWin\(\)/);
  assert.doesNotMatch(audio, /ultraWin\(\): void \{\s*this\.megaWin\(\)/);
  assert.doesNotMatch(audio, /jackpot\(\): void \{\s*this\.ultraWin\(\)/);
});

test("buffalo win actions cover commercial ladder", () => {
  const src = read("client/m5/scene/buffalo.ts");
  for (const fn of [
    "lowRoar",
    "headUp",
    "lookAtWin",
    "charge",
    "jumpOut",
    "slowWalk",
    "standRoar",
    "breakReel",
    "bigWin",
    "jackpot",
  ]) {
    assert.match(src, new RegExp(`${fn}\\(\\)`));
  }
});

test("HUD + i18n include Super/Epic", () => {
  const hud = read("client/m5/ui/hud.ts");
  assert.match(hud, /superWin/);
  assert.match(hud, /epicWin/);
  assert.match(hud, /flashMeters/);
  const i18n = read("client/m5/i18n.ts");
  assert.match(i18n, /superWin:\s*"SUPER WIN"/);
  assert.match(i18n, /epicWin:\s*"EPIC WIN"/);
  assert.match(i18n, /superWin:\s*"至尊巨赢"/);
});

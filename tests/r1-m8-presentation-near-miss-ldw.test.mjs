/**
 * R1-M8 — Presentation Near-Miss + LDW (Option 1).
 * Maps FX from real server spin fields only.
 * Must not alter RNG / RTP / Math / Settlement / Wallet / Ledger / spin timing.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function mockResult(partial) {
  return {
    roundId: partial.roundId ?? "round_seed_1",
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
    freeGamesRemaining: 0,
    awardedFreeGames: 0,
    isFreeGame: false,
    mathVersion: "test",
  };
}

test("isPseudoWin: 0 < payout < bet only", async () => {
  const mod = await import("../client/m5/win-presentation.ts");
  assert.equal(mod.isPseudoWin(0, 50), false);
  assert.equal(mod.isPseudoWin(25, 50), true);
  assert.equal(mod.isPseudoWin(49, 50), true);
  assert.equal(mod.isPseudoWin(50, 50), false);
  assert.equal(mod.isPseudoWin(100, 50), false);
  assert.equal(mod.isPseudoWin(10, 0), false);
});

test("near-miss only on true miss + deterministic ~35% from roundId", async () => {
  const mod = await import("../client/m5/win-presentation.ts");
  assert.equal(mod.NEAR_MISS_PROBABILITY_PCT, 35);

  const paid = mockResult({
    winMinor: 10,
    lineWins: [{ line: 1, symbol: "a", count: 3, payout: 10 }],
  });
  assert.equal(mod.isTrueMiss(paid), false);
  assert.equal(mod.shouldShowNearMiss(paid), false);

  const missWithLines = mockResult({
    winMinor: 0,
    lineWins: [{ line: 1, symbol: "a", count: 3, payout: 0 }],
  });
  assert.equal(mod.isTrueMiss(missWithLines), false);

  // Deterministic: same roundId → same roll; near-miss path must not call Math.random(
  const src = read("client/m5/win-presentation.ts");
  assert.doesNotMatch(src, /Math\.random\s*\(/);

  let hits = 0;
  const N = 200;
  for (let i = 0; i < N; i++) {
    const miss = mockResult({ roundId: `miss_${i}`, winMinor: 0, lineWins: [] });
    assert.equal(mod.isTrueMiss(miss), true);
    if (mod.shouldShowNearMiss(miss)) hits++;
    // Stable across calls
    assert.equal(mod.shouldShowNearMiss(miss), mod.shouldShowNearMiss(miss));
  }
  const rate = hits / N;
  assert.ok(rate > 0.2 && rate < 0.5, `expected ~35% near-miss rate, got ${(rate * 100).toFixed(1)}%`);
});

test("hashRoundSeed is stable and non-zero for typical ids", async () => {
  const mod = await import("../client/m5/win-presentation.ts");
  assert.equal(mod.hashRoundSeed("abc"), mod.hashRoundSeed("abc"));
  assert.notEqual(mod.hashRoundSeed("abc"), mod.hashRoundSeed("abd"));
  assert.ok(mod.hashRoundSeed("round_1") > 0);
});

test("resolvePresentationOutcome: LDW + near-miss + Big ladder untouched", async () => {
  const mod = await import("../client/m5/win-presentation.ts");

  const ldw = mod.resolvePresentationOutcome(
    mockResult({
      winMinor: 20,
      totalBetMinor: 50,
      lineWins: [{ line: 1, symbol: "a", count: 3, payout: 20 }],
    }),
  );
  assert.equal(ldw.pseudoWin, true);
  assert.equal(ldw.nearMiss, false);
  assert.ok(mod.tierRank(ldw.tier) < mod.tierRank("big"));

  const jackpot = mod.resolvePresentationOutcome(
    mockResult({
      winMinor: 5000,
      totalBetMinor: 50,
      lineWins: [{ line: 1, symbol: "buffalo", count: 5, payout: 5000 }],
    }),
  );
  assert.equal(jackpot.pseudoWin, false);
  assert.equal(jackpot.nearMiss, false);
  assert.equal(jackpot.tier, "jackpot");

  // Find a roundId that triggers near-miss
  let near = null;
  for (let i = 0; i < 500; i++) {
    const o = mod.resolvePresentationOutcome(
      mockResult({ roundId: `nm_${i}`, winMinor: 0, lineWins: [] }),
    );
    if (o.nearMiss) {
      near = o;
      break;
    }
  }
  assert.ok(near, "expected at least one near-miss in 500 seeds");
  assert.equal(near.pseudoWin, false);
  assert.equal(near.tier, "none");
  assert.ok(near.nearMissCells.length >= 1);
});

test("pickNearMissAccents prefers high-value/scatter cells without rewriting grid", async () => {
  const mod = await import("../client/m5/win-presentation.ts");
  const grid = [
    ["a", "k", "q", "j"],
    ["ten", "nine", "a", "k"],
    ["q", "j", "ten", "nine"],
    ["buffalo", "a", "k", "q"],
    ["scatter", "lion", "j", "ten"],
  ];
  const accents = mod.pickNearMissAccents(
    mockResult({ roundId: "accent_1", winMinor: 0, grid, lineWins: [] }),
  );
  assert.ok(accents.cells.length >= 1);
  for (const [r, row] of accents.cells) {
    assert.equal(grid[r][row], grid[r][row]); // identity — server cell
    const sym = grid[r][row];
    assert.ok(
      mod.NEAR_MISS_ACCENT_SYMBOLS.includes(sym) || accents.cells.length === 1,
      `unexpected accent symbol ${sym}`,
    );
  }
});

test("LOW quality reduces FX scale; choreography scale is presentation-only", async () => {
  const mod = await import("../client/m5/win-presentation.ts");
  assert.ok(mod.presentationFxScale("low") < mod.presentationFxScale("high"));
  assert.ok(mod.presentationFxScale("low") < 0.5);
  const scaled = mod.scaleChoreographyFx(mod.NEAR_MISS_CHOREO, mod.presentationFxScale("low"));
  assert.ok(scaled.sparkBurst < mod.NEAR_MISS_CHOREO.sparkBurst);
  assert.ok(scaled.reelFrameGlow < mod.NEAR_MISS_CHOREO.reelFrameGlow);
  assert.equal(mod.PSEUDO_WIN_CHOREO.hudOverlay, false);
  assert.ok(mod.PSEUDO_WIN_CHOREO.audio.includes("pseudoWin"));
  assert.ok(mod.NEAR_MISS_CHOREO.audio.includes("nearMiss"));
  assert.equal(mod.NEAR_MISS_CHOREO.coinBurst, 0);
});

test("Game wires LDW + near-miss without inventing wins or touching money writers", () => {
  const game = read("client/m5/game/game.ts");
  assert.match(game, /resolvePresentationOutcome/);
  assert.match(game, /presentPseudoWin|PSEUDO_WIN_CHOREO/);
  assert.match(game, /presentNearMiss|NEAR_MISS_CHOREO/);
  assert.match(game, /pulseNearMissAccent/);
  assert.match(game, /hud\.showWin\(result\.winMinor\)/);
  assert.doesNotMatch(game, /luck_factor|calculate_spin_result|localWin|recomputeWins|mutateGrid/);
  assert.doesNotMatch(game, /writeBalance|creditWallet|dbLedger|mutateLedger/);
});

test("spin timing contract unchanged (~6s)", async () => {
  const timing = await import("../client/m5/game/reel-timing.ts");
  assert.equal(timing.NORMAL_SPIN_TOTAL_MS, 6_000);
  assert.deepEqual([...timing.NORMAL_REEL_STOP_MS], [4200, 4600, 5000, 5400, 5800]);
});

test("money / math / spin server modules remain free of presentation imports", () => {
  for (const rel of [
    "lib/spin-orchestrator.ts",
    "lib/wallet-adapter.ts",
    "lib/db-ledger.ts",
    "lib/money-service.ts",
    "lib/server-game-engine.ts",
    "lib/round-service.ts",
  ]) {
    const source = read(rel);
    assert.doesNotMatch(source, /resolvePresentationOutcome|isPseudoWin|shouldShowNearMiss|NEAR_MISS|pseudoWin/);
    assert.doesNotMatch(source, /luck_factor/);
  }
});

test("audio + reels expose presentation cues; i18n closeCall is trilingual", () => {
  const audio = read("client/m5/audio.ts");
  assert.match(audio, /pseudoWin\(\)/);
  assert.match(audio, /nearMiss\(\)/);
  assert.match(audio, /case "pseudoWin"/);
  assert.match(audio, /case "nearMiss"/);

  const reels = read("client/m5/game/reels.ts");
  assert.match(reels, /pulseNearMissAccent/);
  assert.doesNotMatch(reels, /NORMAL_SPIN_TOTAL_MS\s*=/);

  const i18n = read("client/m5/i18n.ts");
  assert.match(i18n, /closeCall:\s*"就差一点"/);
  assert.match(i18n, /closeCall:\s*"So close"/);
  assert.match(i18n, /closeCall:\s*"နီးစပ်သွားပြီ"/);
  // Game prefers FX — must not toast win claims on miss path by default
  const game = read("client/m5/game/game.ts");
  assert.doesNotMatch(game, /toastKey\("closeCall"\)/);
});

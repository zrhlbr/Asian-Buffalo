import assert from "node:assert/strict";
import test from "node:test";
import { PAYLINES, ROOM_BASE_BETS, BET_LEVELS, BET_MULTIPLIERS } from "../lib/game-config.ts";
import { INITIAL_MATH_VERSION } from "../lib/math-config.ts";
import {
  evaluateFixedGrid,
  generateServerSpinOutcome,
  randomInt,
  ServerGameError,
} from "../lib/server-game-engine.ts";

const mathConfig = INITIAL_MATH_VERSION;

function totalBet(room, level, multiplier) {
  return room * level * multiplier;
}

test("randomInt produces values within range", () => {
  for (let max = 1; max <= 100; max += 1) {
    const value = randomInt(max);
    assert.ok(value >= 0 && value < max, `value ${value} out of range for max ${max}`);
  }
});

test("randomInt rejects invalid ranges", () => {
  assert.throws(() => randomInt(0), RangeError);
  assert.throws(() => randomInt(-1), RangeError);
  assert.throws(() => randomInt(1.5), RangeError);
});

test("WILD only appears on reels 2, 3, 4", () => {
  for (let i = 0; i < 200; i += 1) {
    const outcome = generateServerSpinOutcome(mathConfig, totalBet(50, 1, 1), false);
    outcome.grid.forEach((reel, reelIndex) => {
      reel.forEach((symbol) => {
        if (symbol === "wild") {
          assert.ok(
            reelIndex >= 1 && reelIndex <= 3,
            `WILD found on reel ${reelIndex}`,
          );
        }
      });
    });
  }
});

test("SCATTER can appear on any reel", () => {
  const seenReels = new Set();
  for (let i = 0; i < 1000 && seenReels.size < 5; i += 1) {
    const outcome = generateServerSpinOutcome(mathConfig, totalBet(50, 1, 1), false);
    outcome.grid.forEach((reel, reelIndex) => {
      if (reel.includes("scatter")) seenReels.add(reelIndex);
    });
  }
  assert.equal(seenReels.size, 5, "SCATTER should be able to appear on all 5 reels");
});

test("buffalo pays for 2-of-a-kind on first payline", () => {
  const grid = [
    ["buffalo", "a", "k", "q"],
    ["buffalo", "nine", "nine", "nine"],
    ["j", "nine", "nine", "nine"],
    ["ten", "nine", "nine", "nine"],
    ["nine", "nine", "nine", "nine"],
  ];
  const outcome = evaluateFixedGrid({
    grid,
    totalBetMinor: totalBet(50, 1, 1),
    inFreeGames: false,
    mathConfig,
  });
  const buffaloWin = outcome.evaluation.lineWins.find(
    (win) => win.symbol === "buffalo" && win.count === 2,
  );
  assert.ok(buffaloWin, "expected a 2-buffalo line win");
  assert.equal(buffaloWin.payout, 10); // 2 buffalo = 10x line bet; line bet = 1
});

test("non-buffalo symbols require 3-of-a-kind", () => {
  const grid = [
    ["lion", "a", "k", "q"],
    ["lion", "nine", "nine", "nine"],
    ["lion", "nine", "nine", "nine"],
    ["j", "nine", "nine", "nine"],
    ["ten", "nine", "nine", "nine"],
  ];
  const outcome = evaluateFixedGrid({
    grid,
    totalBetMinor: totalBet(50, 1, 1),
    inFreeGames: false,
    mathConfig,
  });
  const lionWin = outcome.evaluation.lineWins.find(
    (win) => win.symbol === "lion" && win.count === 3,
  );
  assert.ok(lionWin, "expected a 3-lion line win");
  assert.equal(lionWin.payout, 50); // 3 lion = 50x line bet
});

test("WILD substitutes for regular symbols but not SCATTER", () => {
  const grid = [
    ["lion", "lion", "ten", "buffalo"],
    ["wild", "wild", "q", "elephant"],
    ["lion", "antelope", "scatter", "k"],
    ["elephant", "j", "wild", "lion"],
    ["buffalo", "ten", "zebra", "a"],
  ];
  const outcome = evaluateFixedGrid({
    grid,
    totalBetMinor: totalBet(50, 1, 1),
    inFreeGames: false,
    mathConfig,
  });
  assert.ok(
    outcome.evaluation.lineWins.some((win) => win.symbol === "lion" && win.count >= 3),
    "WILD should help complete lion line",
  );
});

test("3/4/5 SCATTER pays total-bet multiples and awards free games", () => {
  const grid = [
    ["scatter", "lion", "ten", "buffalo"],
    ["scatter", "wild", "q", "elephant"],
    ["nine", "antelope", "scatter", "k"],
    ["elephant", "j", "wild", "lion"],
    ["buffalo", "ten", "zebra", "a"],
  ];
  const outcome = evaluateFixedGrid({
    grid,
    totalBetMinor: totalBet(50, 1, 1),
    inFreeGames: false,
    mathConfig,
  });
  assert.equal(outcome.evaluation.scatterCount, 3);
  assert.equal(outcome.evaluation.scatterWin, 2 * totalBet(50, 1, 1)); // 3 scatter = 2x total bet
  assert.equal(outcome.evaluation.awardedFreeGames, 8);
});

test("free-game retrigger awards additional games for 2+ SCATTER", () => {
  const grid = [
    ["scatter", "lion", "ten", "buffalo"],
    ["scatter", "wild", "q", "elephant"],
    ["nine", "antelope", "scatter", "k"],
    ["elephant", "j", "wild", "lion"],
    ["buffalo", "ten", "zebra", "a"],
  ];
  const outcome = evaluateFixedGrid({
    grid,
    totalBetMinor: totalBet(50, 1, 1),
    inFreeGames: true,
    mathConfig,
  });
  assert.equal(outcome.evaluation.scatterCount, 3);
  assert.equal(outcome.evaluation.awardedFreeGames, 8);
});

test("free-game WILD multiplier is applied to line wins", () => {
  const grid = [
    ["lion", "lion", "ten", "buffalo"],
    ["wild", "wild", "q", "elephant"],
    ["lion", "antelope", "scatter", "k"],
    ["elephant", "j", "wild", "lion"],
    ["buffalo", "ten", "zebra", "a"],
  ];
  const baseOutcome = evaluateFixedGrid({
    grid,
    totalBetMinor: totalBet(50, 1, 1),
    inFreeGames: false,
    mathConfig,
  });
  const freeOutcome = evaluateFixedGrid({
    grid,
    totalBetMinor: totalBet(50, 1, 1),
    inFreeGames: true,
    mathConfig,
  });
  assert.equal(freeOutcome.evaluation.multiplier >= 2, true);
  assert.equal(freeOutcome.evaluation.totalWin, baseOutcome.evaluation.lineWin * freeOutcome.evaluation.multiplier);
});

test("totalBet must be divisible by payline count", () => {
  assert.throws(
    () => generateServerSpinOutcome(mathConfig, 51, false),
    ServerGameError,
  );
});

test("all valid room/level/multiplier combinations produce integer line bets", () => {
  for (const room of ROOM_BASE_BETS) {
    for (const level of BET_LEVELS) {
      for (const multiplier of BET_MULTIPLIERS) {
        const bet = totalBet(room, level, multiplier);
        const outcome = generateServerSpinOutcome(mathConfig, bet, false);
        assert.equal(outcome.lineBetMinor, bet / PAYLINES.length);
        assert.ok(Number.isSafeInteger(outcome.lineBetMinor));
        assert.ok(Number.isSafeInteger(outcome.evaluation.totalWin));
      }
    }
  }
});

test("fixed grid evaluation is deterministic", () => {
  const grid = [
    ["buffalo", "lion", "ten", "buffalo"],
    ["buffalo", "wild", "q", "elephant"],
    ["nine", "antelope", "scatter", "k"],
    ["elephant", "j", "wild", "lion"],
    ["buffalo", "ten", "zebra", "a"],
  ];
  const first = evaluateFixedGrid({
    grid,
    totalBetMinor: totalBet(50, 1, 1),
    inFreeGames: false,
    mathConfig,
  });
  const second = evaluateFixedGrid({
    grid,
    totalBetMinor: totalBet(50, 1, 1),
    inFreeGames: false,
    mathConfig,
  });
  assert.deepEqual(first.evaluation, second.evaluation);
});

test("generated outcome contains audit metadata", () => {
  const outcome = generateServerSpinOutcome(mathConfig, totalBet(50, 1, 1), false);
  assert.equal(outcome.mathVersion, mathConfig.version);
  assert.ok(outcome.generatedAt);
  assert.equal(outcome.grid.length, 5);
  assert.equal(outcome.grid[0].length, 4);
});

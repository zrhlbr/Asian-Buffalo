/**
 * Reel timing contracts — ~6s normal spin, faster cruise, downward only.
 * Presentation-only; does not touch Wallet / Math / API.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const {
  NORMAL_SPIN_TOTAL_MS,
  NORMAL_REEL_STOP_MS,
  TURBO_SPIN_TOTAL_MS,
  TURBO_REEL_STOP_MS,
  SPIN_SPEED_MULT,
  spinTimingProfile,
  spinMotionProgress,
  spinStripDistance,
} = await import("../client/m5/game/reel-timing.ts");

test("normal spin total is ~6s with staggered stops before bounce", () => {
  assert.equal(NORMAL_SPIN_TOTAL_MS, 6_000);
  assert.deepEqual([...NORMAL_REEL_STOP_MS], [4200, 4600, 5000, 5400, 5800]);
  assert.equal(NORMAL_REEL_STOP_MS.length, 5);
  for (let i = 1; i < NORMAL_REEL_STOP_MS.length; i++) {
    assert.ok(NORMAL_REEL_STOP_MS[i] > NORMAL_REEL_STOP_MS[i - 1], "stops stagger forward");
  }
  const lastStop = NORMAL_REEL_STOP_MS[4];
  const profile = spinTimingProfile(false);
  // 5800 + bounce(200) = 6000; allow ±150ms product tolerance band in contract
  assert.ok(lastStop + profile.bounceMs <= NORMAL_SPIN_TOTAL_MS + 150);
  assert.ok(lastStop + profile.bounceMs >= NORMAL_SPIN_TOTAL_MS - 150);
  assert.equal(lastStop + profile.bounceMs, NORMAL_SPIN_TOTAL_MS);
});

test("turbo keeps independent fast cadence (2–3s), still uses same profile helper", () => {
  assert.ok(TURBO_SPIN_TOTAL_MS >= 2000 && TURBO_SPIN_TOTAL_MS <= 3000);
  assert.equal(TURBO_REEL_STOP_MS.length, 5);
  const turbo = spinTimingProfile(true);
  assert.equal(turbo.totalMs, TURBO_SPIN_TOTAL_MS);
  assert.ok(turbo.stopMs[4] < turbo.totalMs);
  assert.ok(turbo.totalMs < NORMAL_SPIN_TOTAL_MS / 2);
});

test("speed mult and strip distance increase cruise impact", () => {
  assert.ok(SPIN_SPEED_MULT >= 1.25 && SPIN_SPEED_MULT <= 1.5);
  const d0 = spinStripDistance(0, SPIN_SPEED_MULT);
  const d4 = spinStripDistance(4, SPIN_SPEED_MULT);
  assert.ok(d0 >= 70, `reel0 strip too short: ${d0}`);
  assert.ok(d4 > d0);
});

test("motion progress is monotonic downward (non-decreasing)", () => {
  let prev = 0;
  for (let i = 0; i <= 100; i++) {
    const p = spinMotionProgress(i / 100);
    assert.ok(p >= prev - 1e-9, `regress at t=${i / 100}`);
    prev = p;
  }
  assert.ok(spinMotionProgress(0) < 0.01);
  assert.ok(Math.abs(spinMotionProgress(1) - 1) < 1e-6);
  // Cruise stays ahead of pure ease-out early — more of the strip used mid-spin
  assert.ok(spinMotionProgress(0.5) > 0.45);
});

test("timing is centralized — game does not hardcode reel base/step durations", () => {
  const reels = readFileSync(join(root, "client/m5/game/reels.ts"), "utf8");
  const game = readFileSync(join(root, "client/m5/game/game.ts"), "utf8");
  assert.match(reels, /from \"\.\/reel-timing\.ts\"/);
  assert.match(reels, /NORMAL_SPIN_TOTAL_MS|spinTimingProfile/);
  assert.doesNotMatch(reels, /const base = turbo \? 0\.38/);
  assert.doesNotMatch(game, /base \+ i \* step/);
  // Busy lock still gates repeat spins
  assert.match(game, /if \(this\.busy\) return/);
  assert.match(game, /this\.busy = true/);
});

test("direction remains down in reels module", () => {
  const reels = readFileSync(join(root, "client/m5/game/reels.ts"), "utf8");
  assert.match(reels, /REEL_SPIN_DIRECTION = \"down\"/);
  assert.match(reels, /spinMotionProgress/);
});

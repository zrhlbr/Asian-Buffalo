/**
 * Reel spin direction — must be top → bottom (down).
 * Pure math + source contract tests (no Wallet/Math/API changes).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reelsSrc = readFileSync(join(root, "client/m5/game/reels.ts"), "utf8");

const ROWS = 4;
const CELL = 1.12;
const GAP = 0.02;
const STEP = CELL + GAP;

function cellY(r, frac) {
  return (ROWS / 2 - 0.5 - r - frac) * STEP;
}
function stripIndex(base, r) {
  return base - r + (ROWS - 1);
}
function toSpinSeq(col) {
  return col.slice().reverse();
}
function fromSpinSeqWindow(seq, base) {
  const out = [];
  for (let r = 0; r < ROWS; r++) out.push(seq[stripIndex(base, r)]);
  return out;
}

test("contract: REEL_SPIN_DIRECTION is down and frac subtracts Y", () => {
  assert.match(reelsSrc, /REEL_SPIN_DIRECTION = \"down\"/);
  assert.match(reelsSrc, /TOP → BOTTOM|top→bottom|top-to-bottom/i);
  // Must subtract frac (down). Forbid the old upward "+ frac" rest formula in cellY.
  assert.match(reelsSrc, /ROWS \/ 2 - 0\.5 - r - frac/);
  assert.doesNotMatch(
    reelsSrc,
    /function cellY\(r: number, frac: number\): number \{\s*return \(ROWS \/ 2 - 0\.5 - r \+ frac\)/,
  );
});

test("downward: increasing frac lowers world Y (symbols move top→bottom)", () => {
  for (let r = 0; r < ROWS; r++) {
    const y0 = cellY(r, 0);
    const y1 = cellY(r, 0.5);
    const y2 = cellY(r, 1);
    assert.ok(y1 < y0, `row ${r}: mid frac must be below rest`);
    assert.ok(y2 < y1, `row ${r}: full frac must continue downward`);
    assert.ok(Math.abs(y2 - cellY(r + 1, 0)) < 1e-9, `row ${r}: frac=1 lands on row ${r + 1} rest`);
  }
});

test("downward wrap: symbol identity moves to the next lower row", () => {
  const base = 3;
  const r = 1;
  const idxBefore = stripIndex(base, r);
  const idxAfterAtNextRow = stripIndex(base + 1, r + 1);
  assert.equal(idxBefore, idxAfterAtNextRow);
});

test("stop window restores server column (row0 = top) for normal and turbo lengths", () => {
  const target = ["buffalo", "lion", "elephant", "zebra"];
  for (const prefixLen of [6, 8, 10, 12]) {
    // mirrors spin(): prefix then toSpinSeq(target)
    const prefix = Array.from({ length: prefixLen }, (_, i) => `p${i}`);
    const seq = [...prefix, ...toSpinSeq(target)];
    const shown = fromSpinSeqWindow(seq, prefixLen);
    assert.deepEqual(shown, target, `prefixLen=${prefixLen}`);
  }
});

test("setGrid encoding matches spin stop encoding", () => {
  const col = ["a", "k", "q", "j"];
  const seq = toSpinSeq(col);
  assert.deepEqual(fromSpinSeqWindow(seq, 0), col);
});

test("bounce overshoot uses positive extraFrac (down first, then settle)", () => {
  assert.match(reelsSrc, /layout\(0\.22 \* elastic\)/);
  // Old upward bounce used negative extraFrac — must not remain
  assert.doesNotMatch(reelsSrc, /layout\(-0\.28 \* elastic\)/);
});

test("turbo and normal share spinAll path (same direction)", () => {
  assert.match(reelsSrc, /spinAll\(grid: SymbolId\[\]\[\], turbo: boolean\)/);
  assert.match(reelsSrc, /spinTimingProfile\(turbo\)/);
  assert.match(reelsSrc, /reel\.spin\(/);
  // durations differ; direction helpers are shared
  assert.match(reelsSrc, /stripIndex/);
  assert.match(reelsSrc, /toSpinSeq/);
  assert.match(reelsSrc, /spinMotionProgress/);
});

test("recovery uses setGrid (no reverse spin animation)", () => {
  const game = readFileSync(join(root, "client/m5/game/game.ts"), "utf8");
  assert.match(game, /setGrid\(/);
  assert.match(reelsSrc, /setGrid\(col: SymbolId\[\]\): void/);
  assert.match(reelsSrc, /bounceT = -1/);
});

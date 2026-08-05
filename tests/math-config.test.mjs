import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInitialMathVersion,
  hashMathVersionConfig,
  INITIAL_MATH_VERSION,
  RealMoneyBlockedError,
  validateRealMoneyAllowed,
} from "../lib/math-config.ts";

test("initial math version uses Asian Buffalo branding and DRAFT status", () => {
  assert.ok(!INITIAL_MATH_VERSION.gameVersion.toLowerCase().includes("afb"));
  assert.ok(!INITIAL_MATH_VERSION.gameVersion.toLowerCase().includes("african"));
  assert.equal(INITIAL_MATH_VERSION.gameVersion, "asb-prototype-0.1.0");
  assert.equal(INITIAL_MATH_VERSION.status, "DRAFT");
  assert.equal(INITIAL_MATH_VERSION.disclosure.realMoneyEnabled, false);
  assert.equal(INITIAL_MATH_VERSION.disclosure.targetRtp, null);
  assert.equal(INITIAL_MATH_VERSION.disclosure.status, "UNCALIBRATED_PROTOTYPE");
  assert.equal(INITIAL_MATH_VERSION.reelWeights.kind, "per-reel");
  assert.ok(INITIAL_MATH_VERSION.reelWeights.note.toLowerCase().includes("temporary"));
  assert.equal(INITIAL_MATH_VERSION.maxPayout.kind, "candidate");
});

test("hash is stable across repeated serializations", async () => {
  const first = await hashMathVersionConfig(INITIAL_MATH_VERSION);
  const second = await hashMathVersionConfig(INITIAL_MATH_VERSION);
  assert.equal(first.length, 64);
  assert.equal(first, second);
});

test("hash changes when config changes", async () => {
  const original = await hashMathVersionConfig(INITIAL_MATH_VERSION);
  const modified = buildInitialMathVersion({ version: "ab-math-1.0.1" });
  const modifiedHash = await hashMathVersionConfig(modified);
  assert.notEqual(original, modifiedHash);
});

test("INITIAL_MATH_VERSION is blocked from real-money settlement", () => {
  assert.throws(
    () => validateRealMoneyAllowed(INITIAL_MATH_VERSION),
    RealMoneyBlockedError,
  );

  try {
    validateRealMoneyAllowed(INITIAL_MATH_VERSION);
    assert.fail("expected RealMoneyBlockedError");
  } catch (error) {
    assert.ok(error instanceof RealMoneyBlockedError);
    assert.match(error.message, /status is DRAFT/);
    assert.match(error.message, /UNCALIBRATED_PROTOTYPE/);
    assert.match(error.message, /targetRtp is null/);
    assert.match(error.message, /realMoneyEnabled is false/);
    assert.match(error.message, /reelWeights are marked as temporary/);
    assert.match(error.message, /maxPayout is marked as candidate/);
  }
});

test("a frozen, calibrated, real-money-enabled version passes validation", () => {
  const frozen = buildInitialMathVersion({ version: "ab-math-2.0.0", status: "FROZEN" });
  frozen.disclosure.status = "FROZEN";
  frozen.disclosure.targetRtp = 96.5;
  frozen.disclosure.realMoneyEnabled = true;
  frozen.reelWeights = {
    kind: "per-reel",
    reels: frozen.reelWeights.reels,
    note: "Calibrated and frozen after 100M round simulation.",
  };
  frozen.maxPayout = {
    kind: "fixed",
    totalBetMultiplier: 2500,
    note: "Frozen max payout.",
  };

  assert.doesNotThrow(() => validateRealMoneyAllowed(frozen));
});

test("each provisional marker independently blocks real money", () => {
  const base = buildInitialMathVersion({ version: "ab-math-test", status: "FROZEN" });
  base.disclosure.status = "FROZEN";
  base.disclosure.targetRtp = 96.5;
  base.disclosure.realMoneyEnabled = true;
  base.reelWeights = {
    kind: "per-reel",
    reels: base.reelWeights.reels,
    note: "Calibrated and frozen after 100M round simulation.",
  };
  base.maxPayout = {
    kind: "fixed",
    totalBetMultiplier: 2500,
    note: "Frozen max payout.",
  };

  const draft = structuredClone(base);
  draft.status = "DRAFT";
  assert.throws(() => validateRealMoneyAllowed(draft), RealMoneyBlockedError);

  const uncalibrated = structuredClone(base);
  uncalibrated.disclosure.status = "UNCALIBRATED_PROTOTYPE";
  assert.throws(() => validateRealMoneyAllowed(uncalibrated), RealMoneyBlockedError);

  const noRtp = structuredClone(base);
  noRtp.disclosure.targetRtp = null;
  assert.throws(() => validateRealMoneyAllowed(noRtp), RealMoneyBlockedError);

  const notEnabled = structuredClone(base);
  notEnabled.disclosure.realMoneyEnabled = false;
  assert.throws(() => validateRealMoneyAllowed(notEnabled), RealMoneyBlockedError);

  const temporaryWeights = structuredClone(base);
  temporaryWeights.reelWeights = {
    kind: "per-reel",
    reels: base.reelWeights.reels,
    note: "Temporary weights.",
  };
  assert.throws(() => validateRealMoneyAllowed(temporaryWeights), RealMoneyBlockedError);

  const candidatePayout = structuredClone(base);
  candidatePayout.maxPayout = {
    kind: "candidate",
    totalBetMultiplier: 2500,
    note: "Candidate cap.",
  };
  assert.throws(() => validateRealMoneyAllowed(candidatePayout), RealMoneyBlockedError);
});

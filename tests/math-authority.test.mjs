import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  hashMathVersionConfig,
  INITIAL_MATH_VERSION,
} from "../lib/math-config.ts";
import {
  evaluateFixedGrid,
  generateServerSpinOutcome,
  randomInt,
  RANDOM_INT_MAX_EXCLUSIVE,
} from "../lib/server-game-engine.ts";
import {
  MathVersionIntegrityError,
  MathVersionUnavailableError,
  MathVersionValidationError,
  parseAndValidateMathVersion,
  selectMathVersion,
  validateMathVersionConfig,
} from "../lib/math-version-loader.ts";
import {
  buildFrozenMathVersion,
  loadExecutableMathVersion,
} from "./helpers/frozen-math-version.mjs";

const mathConfig = await loadExecutableMathVersion({ version: "ab-authority-base" });

async function frozenRow(overrides = {}) {
  const config = buildFrozenMathVersion(overrides);
  return {
    id: config.version,
    sha256: await hashMathVersionConfig(config),
    status: "FROZEN",
    configJson: JSON.stringify(config),
    activatedAt: "2020-01-01T00:00:00.000Z",
  };
}

test("FROZEN math version loads and validates", async () => {
  const row = await frozenRow({ version: "ab-frozen-load-test" });
  const loaded = await parseAndValidateMathVersion(row);
  assert.equal(loaded.version, "ab-frozen-load-test");
  assert.equal(loaded.status, "FROZEN");
  assert.equal(loaded.disclosure.status, "FROZEN");
  assert.equal(loaded.disclosure.realMoneyEnabled, false);
});

test("DRAFT and RETIRED math versions are rejected", async () => {
  const base = await frozenRow({ version: "ab-status-test" });
  const draft = { ...base, status: "DRAFT" };
  await assert.rejects(parseAndValidateMathVersion(draft), MathVersionValidationError);
  const retired = { ...base, status: "RETIRED" };
  await assert.rejects(parseAndValidateMathVersion(retired), MathVersionValidationError);
});

test("row/config status mismatch fails closed", async () => {
  const config = buildFrozenMathVersion({ version: "ab-status-mismatch" });
  config.status = "DRAFT";
  const row = {
    id: config.version,
    sha256: await hashMathVersionConfig(config),
    status: "FROZEN",
    configJson: JSON.stringify(config),
    activatedAt: "2020-01-01T00:00:00.000Z",
  };
  await assert.rejects(parseAndValidateMathVersion(row), /status mismatch/);
});

test("UNCALIBRATED and null targetRtp fail closed before select returns", async () => {
  const uncalibrated = buildFrozenMathVersion({ version: "ab-uncalibrated" });
  uncalibrated.disclosure.status = "UNCALIBRATED_PROTOTYPE";
  await assert.rejects(
    parseAndValidateMathVersion({
      id: uncalibrated.version,
      sha256: await hashMathVersionConfig(uncalibrated),
      status: "FROZEN",
      configJson: JSON.stringify(uncalibrated),
      activatedAt: "2020-01-01T00:00:00.000Z",
    }),
    /disclosure status/,
  );

  const nullRtp = buildFrozenMathVersion({ version: "ab-null-rtp" });
  nullRtp.disclosure.targetRtp = null;
  await assert.rejects(
    parseAndValidateMathVersion({
      id: nullRtp.version,
      sha256: await hashMathVersionConfig(nullRtp),
      status: "FROZEN",
      configJson: JSON.stringify(nullRtp),
      activatedAt: "2020-01-01T00:00:00.000Z",
    }),
    /targetRtp/,
  );
});

test("SHA-256 mismatch rejects the math version", async () => {
  const row = await frozenRow({ version: "ab-hash-test" });
  row.sha256 = "0".repeat(64);
  await assert.rejects(parseAndValidateMathVersion(row), MathVersionIntegrityError);
});

test("post-hash paytable mutation must fail on deep-frozen config", async () => {
  const loaded = await parseAndValidateMathVersion(
    await frozenRow({ version: "ab-post-hash-tamper" }),
  );
  assert.throws(() => {
    loaded.paytable[0].payouts[5] = 9999;
  }, TypeError);
  assert.throws(() => {
    loaded.disclosure.targetRtp = 1;
  }, TypeError);
});

test("production engine rejects unbranded MathVersionConfig", () => {
  const plain = buildFrozenMathVersion({ version: "ab-unbranded" });
  assert.throws(
    () => generateServerSpinOutcome(plain, 50, false),
    /loader-issued ExecutableMathVersion/,
  );
});

test("corrupt or incomplete config_json rejects the math version", async () => {
  const row = await frozenRow({ version: "ab-corrupt-test" });
  row.configJson = "{not valid json";
  await assert.rejects(parseAndValidateMathVersion(row), MathVersionValidationError);

  const incomplete = await frozenRow({ version: "ab-incomplete-test" });
  incomplete.configJson = JSON.stringify({ version: "ab-incomplete-test", status: "FROZEN" });
  await assert.rejects(parseAndValidateMathVersion(incomplete), MathVersionValidationError);
});

test("no FROZEN math version available fails closed", async () => {
  const draft = await frozenRow({ version: "ab-no-frozen-test" });
  draft.status = "DRAFT";
  await assert.rejects(selectMathVersion([draft]), MathVersionUnavailableError);

  const retired = await frozenRow({ version: "ab-retired-test" });
  retired.status = "RETIRED";
  await assert.rejects(selectMathVersion([retired]), MathVersionUnavailableError);

  await assert.rejects(
    selectMathVersion([], { versionId: "missing" }),
    MathVersionUnavailableError,
  );
});

test("activatedAt must be valid and ties break by version id", async () => {
  const early = await frozenRow({ version: "ab-tie-b" });
  early.activatedAt = "2024-01-01T00:00:00.000Z";
  const lateA = await frozenRow({ version: "ab-tie-a" });
  lateA.activatedAt = "2025-01-01T00:00:00.000Z";
  const lateC = await frozenRow({ version: "ab-tie-c" });
  lateC.activatedAt = "2025-01-01T00:00:00.000Z";

  // Same activatedAt: deterministic ascending id chooses ab-tie-a over ab-tie-c
  // regardless of input order.
  const chosen = await selectMathVersion([lateC, early, lateA]);
  assert.equal(chosen.version, "ab-tie-a");

  const missingActivated = await frozenRow({ version: "ab-missing-activated" });
  missingActivated.activatedAt = null;
  await assert.rejects(selectMathVersion([missingActivated]), /activatedAt/);

  const badActivated = await frozenRow({ version: "ab-bad-activated" });
  badActivated.activatedAt = "not-a-date";
  await assert.rejects(selectMathVersion([badActivated]), /activatedAt/);
});

test("modified paytable changes the spin payout", async () => {
  const basePlain = buildFrozenMathVersion({
    version: "ab-paytable-base",
    maxPayoutMultiplier: 100_000,
  });
  basePlain.paylines = [[0, 0, 0, 0, 0]];
  basePlain.paylineCount = 1;
  basePlain.rooms = { ...basePlain.rooms, lineCount: 1 };

  const modifiedPlain = structuredClone(basePlain);
  modifiedPlain.version = "ab-paytable-modified";
  const buffalo = modifiedPlain.paytable.find((entry) => entry.symbol === "buffalo");
  assert.ok(buffalo);
  buffalo.payouts[5] = 9999;

  const base = await loadExecutableMathVersion(basePlain);
  const modified = await loadExecutableMathVersion(modifiedPlain);

  const grid = [
    ["buffalo", "nine", "nine", "nine"],
    ["buffalo", "nine", "nine", "nine"],
    ["buffalo", "nine", "nine", "nine"],
    ["buffalo", "nine", "nine", "nine"],
    ["buffalo", "nine", "nine", "nine"],
  ];

  const baseOutcome = evaluateFixedGrid({
    grid,
    totalBetMinor: 1,
    inFreeGames: false,
    mathConfig: base,
  });
  const modifiedOutcome = evaluateFixedGrid({
    grid,
    totalBetMinor: 1,
    inFreeGames: false,
    mathConfig: modified,
  });

  assert.equal(baseOutcome.evaluation.lineWins.length, 1);
  assert.equal(modifiedOutcome.evaluation.lineWins.length, 1);
  assert.equal(baseOutcome.evaluation.rawTotalWin, 250);
  assert.equal(modifiedOutcome.evaluation.rawTotalWin, 9999);
  assert.equal(
    modifiedOutcome.evaluation.totalWin - baseOutcome.evaluation.totalWin,
    9999 - 250,
  );
});

test("modified paylines take effect", async () => {
  const basePlain = buildFrozenMathVersion({ version: "ab-paylines-base" });
  basePlain.paylines = [[1, 0, 3, 0, 1]];
  basePlain.paylineCount = 1;
  basePlain.rooms = { ...basePlain.rooms, lineCount: 1 };

  const modifiedPlain = structuredClone(basePlain);
  modifiedPlain.version = "ab-paylines-modified";
  modifiedPlain.paylines = [[0, 1, 2, 1, 0]];

  const base = await loadExecutableMathVersion(basePlain);
  const modified = await loadExecutableMathVersion(modifiedPlain);

  const grid = [
    ["buffalo", "lion", "nine", "nine"],
    ["elephant", "buffalo", "nine", "nine"],
    ["nine", "nine", "buffalo", "zebra"],
    ["antelope", "buffalo", "nine", "nine"],
    ["buffalo", "a", "nine", "nine"],
  ];

  const baseOutcome = evaluateFixedGrid({
    grid,
    totalBetMinor: 1,
    inFreeGames: false,
    mathConfig: base,
  });
  const modifiedOutcome = evaluateFixedGrid({
    grid,
    totalBetMinor: 1,
    inFreeGames: false,
    mathConfig: modified,
  });

  assert.equal(baseOutcome.evaluation.lineWins.length, 0);
  assert.equal(modifiedOutcome.evaluation.lineWins.length, 1);
  assert.equal(modifiedOutcome.evaluation.lineWins[0].symbol, "buffalo");
  assert.equal(modifiedOutcome.evaluation.lineWins[0].count, 5);
});

test("modified reelWeights are used by the generator", async () => {
  const plain = buildFrozenMathVersion({ version: "ab-weights-test" });
  plain.reelWeights = {
    kind: "per-reel",
    reels: Array.from({ length: plain.grid.columns }, () => ({ buffalo: 1 })),
    note: "Frozen per-reel weights for R1-M3-PRE testing.",
  };
  const config = await loadExecutableMathVersion(plain);

  const outcome = generateServerSpinOutcome(config, 50, false);
  for (const reel of outcome.grid) {
    for (const symbol of reel) {
      assert.equal(symbol, "buffalo");
    }
  }
});

test("server engine no longer reads global PAYTABLE or PAYLINES", () => {
  const source = readFileSync(
    new URL("../lib/server-game-engine.ts", import.meta.url),
    "utf-8",
  );
  assert.doesNotMatch(source, /from\s+["']\.\/game-config\.ts["']/);
  assert.doesNotMatch(source, /\bPAYTABLE\b/);
  assert.doesNotMatch(source, /\bPAYLINES\b/);
  assert.doesNotMatch(source, /\bPAYLINE_COUNT\b/);
  assert.doesNotMatch(source, /\bGRID_COLUMNS\b/);
  assert.doesNotMatch(source, /\bGRID_ROWS\b/);
});

test("lib math-config no longer exports buildFrozenMathVersion", () => {
  const source = readFileSync(new URL("../lib/math-config.ts", import.meta.url), "utf-8");
  assert.doesNotMatch(source, /\bbuildFrozenMathVersion\b/);
  const libImports = readFileSync(new URL("../lib/server-game-engine.ts", import.meta.url), "utf-8");
  assert.doesNotMatch(libImports, /tests\/helpers/);
});

test("fixedGrid cannot be injected into generateServerSpinOutcome", () => {
  const fixedGrid = Array.from({ length: mathConfig.grid.columns }, () =>
    Array.from({ length: mathConfig.grid.rows }, () => "buffalo"),
  );
  // @ts-expect-error deliberate extra argument test
  const outcome = generateServerSpinOutcome(mathConfig, 50, false, fixedGrid);
  assert.notStrictEqual(outcome.grid, fixedGrid);
  const allBuffalo = outcome.grid.every((reel) =>
    reel.every((symbol) => symbol === "buffalo"),
  );
  assert.equal(allBuffalo, false);
});

test("same fixed grid under same config is deterministic", async () => {
  const config = await loadExecutableMathVersion({ version: "ab-deterministic-test" });
  const grid = [
    ["buffalo", "lion", "ten", "buffalo"],
    ["buffalo", "wild", "q", "elephant"],
    ["nine", "antelope", "scatter", "k"],
    ["elephant", "j", "wild", "lion"],
    ["buffalo", "ten", "zebra", "a"],
  ];
  const first = evaluateFixedGrid({
    grid,
    totalBetMinor: 50,
    inFreeGames: false,
    mathConfig: config,
  });
  const second = evaluateFixedGrid({
    grid,
    totalBetMinor: 50,
    inFreeGames: false,
    mathConfig: config,
  });
  assert.deepEqual(first.evaluation, second.evaluation);
  assert.deepEqual(first.winningPositions, second.winningPositions);
});

test("version A and version B produce independent results", async () => {
  const versionAPlain = buildFrozenMathVersion({
    version: "ab-version-a",
    gameVersion: "game-a",
  });
  const versionBPlain = structuredClone(versionAPlain);
  versionBPlain.version = "ab-version-b";
  versionBPlain.gameVersion = "game-b";
  const buffaloB = versionBPlain.paytable.find((entry) => entry.symbol === "buffalo");
  assert.ok(buffaloB);
  buffaloB.payouts[5] = 5000;

  const versionA = await loadExecutableMathVersion(versionAPlain);
  const versionB = await loadExecutableMathVersion(versionBPlain);

  const grid = [
    ["buffalo", "nine", "nine", "nine"],
    ["buffalo", "nine", "nine", "nine"],
    ["buffalo", "nine", "nine", "nine"],
    ["buffalo", "nine", "nine", "nine"],
    ["buffalo", "nine", "nine", "nine"],
  ];

  const outcomeA = evaluateFixedGrid({
    grid,
    totalBetMinor: 50,
    inFreeGames: false,
    mathConfig: versionA,
  });
  const outcomeB = evaluateFixedGrid({
    grid,
    totalBetMinor: 50,
    inFreeGames: false,
    mathConfig: versionB,
  });

  assert.notEqual(outcomeA.evaluation.totalWin, outcomeB.evaluation.totalWin);
  assert.equal(outcomeA.mathVersion, versionA.version);
  assert.equal(outcomeB.mathVersion, versionB.version);
});

test("INITIAL_MATH_VERSION is no longer auto-selected for execution", () => {
  assert.equal(INITIAL_MATH_VERSION.status, "DRAFT");
  assert.throws(
    () => generateServerSpinOutcome(INITIAL_MATH_VERSION, 50, false),
    /loader-issued ExecutableMathVersion|status is DRAFT/,
  );
});

test("maxPayout caps ordinary line wins with audit fields", async () => {
  const plain = buildFrozenMathVersion({
    version: "ab-cap-line",
    maxPayoutMultiplier: 10,
  });
  plain.paylines = [[0, 0, 0, 0, 0]];
  plain.paylineCount = 1;
  plain.rooms = { ...plain.rooms, lineCount: 1 };
  const config = await loadExecutableMathVersion(plain);
  const grid = [
    ["buffalo", "nine", "nine", "nine"],
    ["buffalo", "nine", "nine", "nine"],
    ["buffalo", "nine", "nine", "nine"],
    ["buffalo", "nine", "nine", "nine"],
    ["buffalo", "nine", "nine", "nine"],
  ];
  const outcome = evaluateFixedGrid({
    grid,
    totalBetMinor: 1,
    inFreeGames: false,
    mathConfig: config,
  });
  assert.equal(outcome.evaluation.rawTotalWin, 250);
  assert.equal(outcome.evaluation.finalTotalWin, 10);
  assert.equal(outcome.evaluation.totalWin, 10);
  assert.equal(outcome.evaluation.capApplied, true);
});

test("maxPayout caps scatter wins", async () => {
  const plain = buildFrozenMathVersion({
    version: "ab-cap-scatter",
    maxPayoutMultiplier: 1,
  });
  const config = await loadExecutableMathVersion(plain);
  const grid = [
    ["scatter", "nine", "nine", "nine"],
    ["scatter", "nine", "nine", "nine"],
    ["scatter", "nine", "nine", "nine"],
    ["scatter", "nine", "nine", "nine"],
    ["scatter", "nine", "nine", "nine"],
  ];
  const outcome = evaluateFixedGrid({
    grid,
    totalBetMinor: 50,
    inFreeGames: false,
    mathConfig: config,
  });
  assert.ok(outcome.evaluation.rawTotalWin > 50);
  assert.equal(outcome.evaluation.finalTotalWin, 50);
  assert.equal(outcome.evaluation.capApplied, true);
});

test("maxPayout caps free-game multiplier stack", async () => {
  const plain = buildFrozenMathVersion({
    version: "ab-cap-free",
    maxPayoutMultiplier: 5,
  });
  plain.paylines = [[0, 0, 0, 0, 0]];
  plain.paylineCount = 1;
  plain.rooms = { ...plain.rooms, lineCount: 1 };
  plain.wild = {
    ...plain.wild,
    freeGameMultiplier: {
      kind: "per-round-random",
      values: [3],
      note: "Fixed multiplier for cap test.",
    },
  };
  const config = await loadExecutableMathVersion(plain);
  const grid = [
    ["buffalo", "nine", "nine", "nine"],
    ["buffalo", "wild", "nine", "nine"],
    ["buffalo", "nine", "nine", "nine"],
    ["buffalo", "nine", "nine", "nine"],
    ["buffalo", "nine", "nine", "nine"],
  ];
  const outcome = evaluateFixedGrid({
    grid,
    totalBetMinor: 1,
    inFreeGames: true,
    mathConfig: config,
  });
  assert.equal(outcome.evaluation.multiplier, 3);
  assert.equal(outcome.evaluation.rawTotalWin, 750);
  assert.equal(outcome.evaluation.finalTotalWin, 5);
  assert.equal(outcome.evaluation.capApplied, true);
});

test("evaluateFixedGrid rejects unknown symbols and illegal WILD/SCATTER positions", async () => {
  const config = await loadExecutableMathVersion({ version: "ab-grid-validate" });
  assert.throws(
    () =>
      evaluateFixedGrid({
        grid: [
          ["not-a-symbol", "nine", "nine", "nine"],
          ["nine", "nine", "nine", "nine"],
          ["nine", "nine", "nine", "nine"],
          ["nine", "nine", "nine", "nine"],
          ["nine", "nine", "nine", "nine"],
        ],
        totalBetMinor: 50,
        inFreeGames: false,
        mathConfig: config,
      }),
    /Unknown symbol/,
  );
  assert.throws(
    () =>
      evaluateFixedGrid({
        grid: [
          ["wild", "nine", "nine", "nine"],
          ["nine", "nine", "nine", "nine"],
          ["nine", "nine", "nine", "nine"],
          ["nine", "nine", "nine", "nine"],
          ["nine", "nine", "nine", "nine"],
        ],
        totalBetMinor: 50,
        inFreeGames: false,
        mathConfig: config,
      }),
    /WILD not allowed/,
  );

  const restricted = buildFrozenMathVersion({ version: "ab-scatter-pos" });
  restricted.scatter = {
    ...restricted.scatter,
    appearsOnReelIndexes: [1, 2, 3],
  };
  // Remove scatter weights from reels that no longer allow scatter.
  restricted.reelWeights = {
    kind: "per-reel",
    reels: restricted.reelWeights.reels.map((reel, index) => {
      if ([1, 2, 3].includes(index)) return reel;
      const next = { ...reel };
      delete next.scatter;
      return next;
    }),
    note: "Frozen per-reel weights for R1-M3-PRE testing.",
  };
  const restrictedConfig = await loadExecutableMathVersion(restricted);
  assert.throws(
    () =>
      evaluateFixedGrid({
        grid: [
          ["scatter", "nine", "nine", "nine"],
          ["nine", "nine", "nine", "nine"],
          ["nine", "nine", "nine", "nine"],
          ["nine", "nine", "nine", "nine"],
          ["nine", "nine", "nine", "nine"],
        ],
        totalBetMinor: 50,
        inFreeGames: false,
        mathConfig: restrictedConfig,
      }),
    /SCATTER not allowed/,
  );
});

test("reelWeights must respect WILD/SCATTER appearsOnReelIndexes", () => {
  const plain = buildFrozenMathVersion({ version: "ab-weight-pos" });
  plain.reelWeights = {
    kind: "per-reel",
    reels: [
      { buffalo: 1, wild: 1 },
      { buffalo: 1 },
      { buffalo: 1 },
      { buffalo: 1 },
      { buffalo: 1 },
    ],
    note: "Frozen per-reel weights for R1-M3-PRE testing.",
  };
  assert.throws(() => validateMathVersionConfig(plain), /wild not allowed on reel 0/);

  plain.reelWeights = {
    kind: "per-reel",
    reels: [
      { buffalo: 1 },
      { buffalo: 1 },
      { buffalo: 1 },
      { buffalo: 1 },
      { buffalo: 1 },
    ],
    note: "Frozen per-reel weights for R1-M3-PRE testing.",
  };
  plain.scatter = { ...plain.scatter, appearsOnReelIndexes: [0, 1, 2] };
  plain.reelWeights.reels[4] = { buffalo: 1, scatter: 1 };
  assert.throws(() => validateMathVersionConfig(plain), /scatter not allowed on reel 4/);
});

test("randomInt bounds reject overflow and avoid infinite loops", () => {
  assert.equal(RANDOM_INT_MAX_EXCLUSIVE, 2 ** 32);
  const edge = randomInt(RANDOM_INT_MAX_EXCLUSIVE);
  assert.ok(edge >= 0 && edge < RANDOM_INT_MAX_EXCLUSIVE);
  assert.throws(() => randomInt(RANDOM_INT_MAX_EXCLUSIVE + 1), RangeError);
  assert.throws(() => randomInt(Number.MAX_SAFE_INTEGER), RangeError);
});

test("PublicSpinRequest schema source rejects fixedGrid", () => {
  const source = readFileSync(new URL("../lib/api-schemas.ts", import.meta.url), "utf-8");
  assert.doesNotMatch(source, /\bfixedGrid\b/);
  const roundSource = readFileSync(new URL("../lib/round-service.ts", import.meta.url), "utf-8");
  const spinRequestBlock = roundSource.match(
    /export type SpinRequest = \{[^}]+\}/,
  )?.[0];
  assert.ok(spinRequestBlock);
  assert.doesNotMatch(spinRequestBlock, /\bfixedGrid\b/);
  assert.match(roundSource, /testFixedGrid\?:/);
});

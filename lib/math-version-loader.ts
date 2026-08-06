/**
 * Math version runtime loader and FROZEN gate.
 *
 * This module is the single authority for converting a persisted math-version
 * row into a trusted, executable MathVersionConfig. It performs strict runtime
 * parsing and integrity checks, verifies the stored SHA-256, runs the full
 * executable gate, deep-freezes the result, and brands it so production code
 * cannot accept arbitrary MathVersionConfig objects.
 */

import { hashMathVersionConfig } from "./math-config.ts";
import type { MathVersionConfig, MathVersionStatus } from "./math-config.ts";

export class MathVersionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MathVersionValidationError";
  }
}

export class MathVersionIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MathVersionIntegrityError";
  }
}

export class MathVersionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MathVersionUnavailableError";
  }
}

/**
 * Session/Round persisted math_version_id does not match the executable
 * config that would generate outcomes. Must fail closed before wallet I/O.
 */
export class MathVersionMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MathVersionMismatchError";
  }
}

/** Opaque brand; only this module may attach it after successful load. */
const EXECUTABLE_BRAND = Symbol("ExecutableMathVersion");

export type ExecutableMathVersion = MathVersionConfig & {
  readonly [EXECUTABLE_BRAND]: true;
};

export type MathVersionRow = {
  id: string;
  sha256: string;
  status: string;
  configJson: string;
  activatedAt?: string | null;
};

/** Uint32 CSPRNG upper bound used by the server engine. */
export const MAX_SAFE_WEIGHT_TOTAL = 0x1_0000_0000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new MathVersionValidationError(message);
  }
}

function expectString(value: unknown, path: string): string {
  assert(typeof value === "string", `${path} must be a string`);
  return value;
}

function expectNumber(value: unknown, path: string): number {
  assert(typeof value === "number" && Number.isFinite(value), `${path} must be a finite number`);
  return value;
}

function expectInt(value: unknown, path: string): number {
  assert(Number.isSafeInteger(value), `${path} must be a safe integer`);
  return value as number;
}

function expectPositiveInt(value: unknown, path: string): number {
  const n = expectInt(value, path);
  assert(n > 0, `${path} must be a positive integer`);
  return n;
}

function expectBoolean(value: unknown, path: string): boolean {
  assert(typeof value === "boolean", `${path} must be a boolean`);
  return value;
}

function expectObject(value: unknown, path: string): Record<string, unknown> {
  assert(isPlainObject(value), `${path} must be an object`);
  return value;
}

function expectArray(value: unknown, path: string): unknown[] {
  assert(Array.isArray(value), `${path} must be an array`);
  return value;
}

function expectNonEmptyNumberArray(value: unknown, path: string): number[] {
  const arr = expectArray(value, path);
  assert(arr.length > 0, `${path} must not be empty`);
  arr.forEach((item, index) => {
    expectNumber(item, `${path}[${index}]`);
  });
  return arr as number[];
}

function expectPayoutMap(
  value: unknown,
  path: string,
  maxColumns: number,
  minCount = 2,
): Record<number, number> {
  const map = expectObject(value, path);
  Object.entries(map).forEach(([key, val]) => {
    const count = Number(key);
    assert(
      Number.isSafeInteger(count) && count >= minCount && count <= maxColumns,
      `${path}[${key}] count must be an integer between ${minCount} and ${maxColumns}`,
    );
    const payout = expectNumber(val, `${path}[${key}]`);
    assert(payout >= 0, `${path}[${key}] payout must be non-negative`);
  });
  return map as Record<number, number>;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value as object)) {
    const child = (value as Record<PropertyKey, unknown>)[key];
    if (child && typeof child === "object") {
      deepFreeze(child);
    }
  }
  return value;
}

function brandExecutable(config: MathVersionConfig): ExecutableMathVersion {
  Object.defineProperty(config, EXECUTABLE_BRAND, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return deepFreeze(config) as ExecutableMathVersion;
}

/**
 * Runtime assertion that a config was issued by this loader after hash verify.
 */
export function assertExecutableMathVersion(
  config: MathVersionConfig,
): asserts config is ExecutableMathVersion {
  if (
    config === null ||
    typeof config !== "object" ||
    (config as { [EXECUTABLE_BRAND]?: unknown })[EXECUTABLE_BRAND] !== true
  ) {
    throw new MathVersionValidationError(
      "math version is not a loader-issued ExecutableMathVersion",
    );
  }
}

/**
 * Strict runtime validation of a MathVersionConfig shape.
 *
 * Throws MathVersionValidationError for any structural problem: missing o
 * malformed fields, out-of-bounds paylines, unknown symbols, inconsistent
 * reel weights, etc. This is intentionally defensive so that only complete,
 * internally consistent configs reach the engine.
 */
export function validateMathVersionConfig(config: unknown): asserts config is MathVersionConfig {
  assert(isPlainObject(config), "config must be an object");
  const c = config as Record<string, unknown>;

  const version = expectString(c.version, "version");
  assert(version.length > 0 && version.length <= 64, "version must be a non-empty string <= 64 chars");

  const gameVersion = expectString(c.gameVersion, "gameVersion");
  assert(gameVersion.length > 0, "gameVersion must be a non-empty string");

  const status = expectString(c.status, "status") as MathVersionStatus;
  assert(["DRAFT", "FROZEN", "RETIRED"].includes(status), "status must be DRAFT, FROZEN, or RETIRED");

  const grid = expectObject(c.grid, "grid");
  const columns = expectPositiveInt(grid.columns, "grid.columns");
  const rows = expectPositiveInt(grid.rows, "grid.rows");
  assert(columns >= 3 && columns <= 7, "grid.columns out of supported range (3-7)");
  assert(rows >= 3 && rows <= 6, "grid.rows out of supported range (3-6)");

  const paylineCount = expectPositiveInt(c.paylineCount, "paylineCount");
  const paylines = expectArray(c.paylines, "paylines");
  assert(paylines.length === paylineCount, `paylineCount ${paylineCount} does not match paylines.length ${paylines.length}`);
  paylines.forEach((line, lineIndex) => {
    const lineArray = expectArray(line, `paylines[${lineIndex}]`);
    assert(
      lineArray.length === columns,
      `paylines[${lineIndex}] length ${lineArray.length} must equal grid.columns ${columns}`,
    );
    lineArray.forEach((rowValue, reelIndex) => {
      const row = expectInt(rowValue, `paylines[${lineIndex}][${reelIndex}]`);
      assert(
        row >= 0 && row < rows,
        `paylines[${lineIndex}][${reelIndex}] row ${row} out of bounds (0-${rows - 1})`,
      );
    });
  });

  const symbols = expectArray(c.symbols, "symbols");
  const symbolIds = new Set<string>();
  symbols.forEach((symbol, index) => {
    const s = expectObject(symbol, `symbols[${index}]`);
    const id = expectString(s.id, `symbols[${index}].id`);
    assert(!symbolIds.has(id), `duplicate symbol id ${id}`);
    symbolIds.add(id);
    expectString(s.label, `symbols[${index}].label`);
    expectString(s.mark, `symbols[${index}].mark`);
  });
  assert(symbolIds.has("scatter"), "symbols must include scatter");
  assert(symbolIds.has("wild"), "symbols must include wild");

  const paytable = expectArray(c.paytable, "paytable");
  const regularSymbols = new Set<string>();
  paytable.forEach((entry, index) => {
    const e = expectObject(entry, `paytable[${index}]`);
    const symbol = expectString(e.symbol, `paytable[${index}].symbol`);
    assert(symbolIds.has(symbol), `paytable[${index}].symbol ${symbol} is not declared in symbols`);
    assert(symbol !== "scatter" && symbol !== "wild", `paytable[${index}].symbol cannot be scatter or wild`);
    expectPayoutMap(e.payouts, `paytable[${index}].payouts`, columns);
    regularSymbols.add(symbol);
  });

  const scatter = expectObject(c.scatter, "scatter");
  const scatterReels = expectArray(scatter.appearsOnReelIndexes, "scatter.appearsOnReelIndexes");
  const scatterReelSet = new Set<number>();
  scatterReels.forEach((reelValue, index) => {
    const reel = expectInt(reelValue, `scatter.appearsOnReelIndexes[${index}]`);
    assert(reel >= 0 && reel < columns, `scatter.appearsOnReelIndexes[${index}] out of bounds`);
    scatterReelSet.add(reel);
  });
  expectPayoutMap(scatter.totalBetMultipliers, "scatter.totalBetMultipliers", columns);
  expectPayoutMap(scatter.baseFreeGames, "scatter.baseFreeGames", columns, 3);
  expectPayoutMap(scatter.retriggerFreeGames, "scatter.retriggerFreeGames", columns, 2);

  const wild = expectObject(c.wild, "wild");
  const wildReels = expectArray(wild.appearsOnReelIndexes, "wild.appearsOnReelIndexes");
  const wildReelSet = new Set<number>();
  wildReels.forEach((reelValue, index) => {
    const reel = expectInt(reelValue, `wild.appearsOnReelIndexes[${index}]`);
    assert(reel >= 0 && reel < columns, `wild.appearsOnReelIndexes[${index}] out of bounds`);
    wildReelSet.add(reel);
  });
  const substitutes = expectArray(wild.substitutes, "wild.substitutes");
  substitutes.forEach((substituteValue, index) => {
    const symbol = expectString(substituteValue, `wild.substitutes[${index}]`);
    assert(symbolIds.has(symbol), `wild.substitutes[${index}] ${symbol} is not declared in symbols`);
    assert(regularSymbols.has(symbol), `wild.substitutes[${index}] ${symbol} is not a regular symbol`);
  });
  const freeGameMultiplier = expectObject(wild.freeGameMultiplier, "wild.freeGameMultiplier");
  expectString(freeGameMultiplier.kind, "wild.freeGameMultiplier.kind");
  const multiplierValues = expectArray(freeGameMultiplier.values, "wild.freeGameMultiplier.values");
  assert(multiplierValues.length > 0, "wild.freeGameMultiplier.values must not be empty");
  multiplierValues.forEach((value, index) => {
    const n = expectPositiveInt(value, `wild.freeGameMultiplier.values[${index}]`);
    assert(n > 0, `wild.freeGameMultiplier.values[${index}] must be positive`);
  });
  expectString(freeGameMultiplier.note, "wild.freeGameMultiplier.note");

  const rooms = expectObject(c.rooms, "rooms");
  expectNonEmptyNumberArray(rooms.baseBets, "rooms.baseBets");
  expectNonEmptyNumberArray(rooms.betLevels, "rooms.betLevels");
  expectNonEmptyNumberArray(rooms.betMultipliers, "rooms.betMultipliers");
  const lineCount = expectPositiveInt(rooms.lineCount, "rooms.lineCount");
  assert(lineCount === paylineCount, "rooms.lineCount must equal paylineCount");

  const reelWeights = expectObject(c.reelWeights, "reelWeights");
  const weightKind = expectString(reelWeights.kind, "reelWeights.kind");
  assert(weightKind === "per-reel", "reelWeights.kind must be per-reel");
  const reels = expectArray(reelWeights.reels, "reelWeights.reels");
  assert(reels.length === columns, `reelWeights.reels.length must equal grid.columns ${columns}`);
  reels.forEach((reelValue, reelIndex) => {
    const reel = expectObject(reelValue, `reelWeights.reels[${reelIndex}]`);
    const entries = Object.entries(reel);
    assert(entries.length > 0, `reelWeights.reels[${reelIndex}] must not be empty`);
    let total = 0;
    entries.forEach(([symbol, weight]) => {
      assert(symbolIds.has(symbol), `reelWeights.reels[${reelIndex}] unknown symbol ${symbol}`);
      if (symbol === "wild") {
        assert(wildReelSet.has(reelIndex), `wild not allowed on reel ${reelIndex}`);
      }
      if (symbol === "scatter") {
        assert(scatterReelSet.has(reelIndex), `scatter not allowed on reel ${reelIndex}`);
      }
      const w = expectPositiveInt(weight, `reelWeights.reels[${reelIndex}].${symbol}`);
      total += w;
      assert(
        Number.isSafeInteger(total) && total <= MAX_SAFE_WEIGHT_TOTAL,
        `reelWeights.reels[${reelIndex}] total weight exceeds CSPRNG-safe range`,
      );
    });
    assert(total > 0, `reelWeights.reels[${reelIndex}] total weight must be positive`);
  });
  expectString(reelWeights.note, "reelWeights.note");

  const maxPayout = expectObject(c.maxPayout, "maxPayout");
  const maxPayoutKind = expectString(maxPayout.kind, "maxPayout.kind");
  assert(["candidate", "fixed"].includes(maxPayoutKind), "maxPayout.kind must be candidate or fixed");
  const maxPayoutMultiplier = expectNumber(maxPayout.totalBetMultiplier, "maxPayout.totalBetMultiplier");
  assert(maxPayoutMultiplier > 0, "maxPayout.totalBetMultiplier must be positive");
  expectString(maxPayout.note, "maxPayout.note");

  const disclosure = expectObject(c.disclosure, "disclosure");
  expectString(disclosure.status, "disclosure.status");
  if (disclosure.targetRtp !== null && disclosure.targetRtp !== undefined) {
    const rtp = expectNumber(disclosure.targetRtp, "disclosure.targetRtp");
    assert(rtp > 0 && rtp < 100, "disclosure.targetRtp must be between 0 and 100");
  }
  expectBoolean(disclosure.originalRtpKnown, "disclosure.originalRtpKnown");
  expectBoolean(disclosure.realMoneyEnabled, "disclosure.realMoneyEnabled");
  const provisionalNotes = expectArray(disclosure.provisionalNotes, "disclosure.provisionalNotes");
  provisionalNotes.forEach((note, index) => {
    expectString(note, `disclosure.provisionalNotes[${index}]`);
  });
}

/**
 * Execution gate for the game engine.
 *
 * Row/config status must already be FROZEN. Disclosure must be FROZEN with a
 * calibrated targetRTP. Candidate / uncalibrated prototypes fail closed.
 */
export function validateExecutableMathVersion(config: MathVersionConfig): void {
  if (config.status !== "FROZEN") {
    throw new MathVersionValidationError(
      `math version ${config.version} status is ${config.status} (must be FROZEN)`,
    );
  }

  validateMathVersionConfig(config);

  if (config.disclosure.status !== "FROZEN") {
    throw new MathVersionValidationError(
      `math version ${config.version} disclosure status is ${config.disclosure.status} (must be FROZEN)`,
    );
  }

  if (
    config.disclosure.targetRtp === null ||
    config.disclosure.targetRtp === undefined ||
    config.disclosure.targetRtp <= 0 ||
    config.disclosure.targetRtp >= 100
  ) {
    throw new MathVersionValidationError(
      `math version ${config.version} targetRtp is missing or invalid`,
    );
  }

  if (config.disclosure.realMoneyEnabled !== false) {
    throw new MathVersionValidationError(
      `math version ${config.version} realMoneyEnabled must be false in this milestone`,
    );
  }

  if (config.maxPayout.kind !== "fixed") {
    throw new MathVersionValidationError(
      `math version ${config.version} maxPayout.kind must be fixed for execution`,
    );
  }

  if (
    config.reelWeights.kind === "per-reel" &&
    config.reelWeights.note.toLowerCase().includes("temporary")
  ) {
    throw new MathVersionValidationError(
      `math version ${config.version} reelWeights are marked as temporary/candidate`,
    );
  }
}

/**
 * Parse, structurally validate, integrity-check, and executable-gate a row.
 *
 * Database row status and config.status must both be FROZEN and identical.
 * On success the returned object is deep-frozen and branded.
 */
export async function parseAndValidateMathVersion(
  row: MathVersionRow,
): Promise<ExecutableMathVersion> {
  if (row.status !== "FROZEN") {
    throw new MathVersionValidationError(
      `math version ${row.id} status is ${row.status} (must be FROZEN)`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.configJson);
  } catch {
    throw new MathVersionValidationError(`math version ${row.id} config_json is not valid JSON`);
  }

  validateMathVersionConfig(parsed);
  const config = parsed as MathVersionConfig;

  if (config.status !== row.status) {
    throw new MathVersionValidationError(
      `math version ${row.id} status mismatch: row ${row.status} vs config ${config.status}`,
    );
  }

  if (config.status !== "FROZEN") {
    throw new MathVersionValidationError(
      `math version ${row.id} config status is ${config.status} (must be FROZEN)`,
    );
  }

  if (config.version !== row.id) {
    throw new MathVersionValidationError(
      `math version id mismatch: row ${row.id} vs config ${config.version}`,
    );
  }

  const computed = await hashMathVersionConfig(config);
  if (computed !== row.sha256) {
    throw new MathVersionIntegrityError(
      `math version ${row.id} SHA-256 mismatch: stored ${row.sha256} vs computed ${computed}`,
    );
  }

  validateExecutableMathVersion(config);
  return brandExecutable(config);
}

function parseActivatedAtMs(value: string | null | undefined, id: string): number {
  if (typeof value !== "string" || value.length === 0) {
    throw new MathVersionUnavailableError(`math version ${id} activatedAt is missing`);
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new MathVersionUnavailableError(`math version ${id} activatedAt is invalid`);
  }
  return ms;
}

/**
 * Select an executable FROZEN math version from a collection of rows.
 *
 * If versionId is provided, only that exact version is accepted and must pass
 * the full executable gate. Otherwise the most recently activated FROZEN
 * version is chosen; ties break by ascending version id for determinism.
 * Database order is never relied upon.
 */
export async function selectMathVersion(
  rows: MathVersionRow[],
  opts: { versionId?: string } = {},
): Promise<ExecutableMathVersion> {
  if (rows.length === 0) {
    throw new MathVersionUnavailableError("no math versions available");
  }

  if (opts.versionId) {
    const row = rows.find((r) => r.id === opts.versionId);
    if (!row) {
      throw new MathVersionUnavailableError(`math version ${opts.versionId} not found`);
    }
    return parseAndValidateMathVersion(row);
  }

  const frozenRows = rows.filter((r) => r.status === "FROZEN");
  if (frozenRows.length === 0) {
    throw new MathVersionUnavailableError("no FROZEN math versions available");
  }

  const ranked = frozenRows
    .map((row) => ({
      row,
      activatedAtMs: parseActivatedAtMs(row.activatedAt, row.id),
    }))
    .sort((a, b) => {
      if (a.activatedAtMs !== b.activatedAtMs) {
        return b.activatedAtMs - a.activatedAtMs;
      }
      return a.row.id.localeCompare(b.row.id);
    });

  return parseAndValidateMathVersion(ranked[0].row);
}

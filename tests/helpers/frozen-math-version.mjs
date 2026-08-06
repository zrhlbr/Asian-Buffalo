/**
 * Test-only helpers for constructing FROZEN math versions.
 *
 * Production code under lib/, app/, and worker/ must never import this module.
 * Executable configs for the engine must be obtained via the loader so they
 * carry the loader brand and are deep-frozen after SHA-256 verification.
 */

import { buildInitialMathVersion, hashMathVersionConfig } from "../../lib/math-config.ts";
import { parseAndValidateMathVersion } from "../../lib/math-version-loader.ts";

/**
 * Build a mutable plain FROZEN candidate config for tests.
 * This is not trusted for the production engine until loaded.
 */
export function buildFrozenMathVersion(overrides = {}) {
  const version = overrides.version ?? "ab-math-frozen-1.0.0";
  const base = buildInitialMathVersion({ version, status: "FROZEN" });

  return {
    ...base,
    gameVersion: overrides.gameVersion ?? base.gameVersion,
    disclosure: {
      status: "FROZEN",
      targetRtp: 96.5,
      originalRtpKnown: false,
      realMoneyEnabled: false,
      provisionalNotes: ["Frozen math version for R1-M3-PRE testing."],
    },
    reelWeights: {
      kind: "per-reel",
      reels: base.reelWeights.reels,
      note: "Frozen per-reel weights for R1-M3-PRE testing.",
    },
    maxPayout: {
      kind: "fixed",
      totalBetMultiplier: overrides.maxPayoutMultiplier ?? 2500,
      note: "Frozen max payout for R1-M3-PRE testing.",
    },
  };
}

/**
 * Load a plain config through the production loader path so the result is a
 * deep-frozen, branded ExecutableMathVersion.
 */
export async function loadExecutableMathVersion(configOrOverrides = {}) {
  const config =
    configOrOverrides && typeof configOrOverrides === "object" && configOrOverrides.version
      && configOrOverrides.paytable
      ? structuredClone(configOrOverrides)
      : buildFrozenMathVersion(configOrOverrides);

  // Ensure structural fields required for executability remain consistent when
  // callers mutate paylines / rooms on a cloned plain config before loading.
  if (config.rooms) {
    config.rooms = {
      ...config.rooms,
      lineCount: config.paylineCount,
    };
  }

  return parseAndValidateMathVersion({
    id: config.version,
    sha256: await hashMathVersionConfig(config),
    status: "FROZEN",
    configJson: JSON.stringify(config),
    activatedAt: "2020-01-01T00:00:00.000Z",
  });
}

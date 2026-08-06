/**
 * Test-only helpers for constructing FROZEN math versions.
 *
 * Production code under lib/, app/, and worker/ must never import this module.
 * Executable configs for the engine must be obtained via the loader so they
 * carry the loader brand and are deep-frozen after SHA-256 verification.
 */

import {
  buildProductionFrozenMathVersion,
  hashMathVersionConfig,
} from "../../lib/math-config.ts";
import { parseAndValidateMathVersion } from "../../lib/math-version-loader.ts";

/**
 * Build a mutable plain FROZEN candidate config for tests.
 * Delegates to the production FROZEN builder so hashes match DB seeds.
 */
export function buildFrozenMathVersion(overrides = {}) {
  return buildProductionFrozenMathVersion(overrides);
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

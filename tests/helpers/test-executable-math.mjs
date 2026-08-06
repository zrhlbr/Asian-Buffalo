/**
 * Shared loader-issued executable math for integration tests.
 * Version id matches INITIAL_MATH_VERSION so session/spin version strings align
 * while the config itself is FROZEN/executable (not the DRAFT prototype).
 * Not for production use.
 */

import { loadExecutableMathVersion } from "./frozen-math-version.mjs";

export const testExecutableMath = await loadExecutableMathVersion({
  version: "ab-math-1.0.0",
});

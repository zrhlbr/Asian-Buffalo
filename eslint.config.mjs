import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    // Read-only Kimi M6 handoff archive — not part of formal runtime.
    "docs/m6-handoff/**",
    // Local review deliverables (screenshots/video/reports) — not lint targets.
    "docs/m6-review/**",
  ]),
]);

export default eslintConfig;

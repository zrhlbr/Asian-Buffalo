/**
 * M5 identity gate security — must be explicitly enabled.
 * Unset / empty / any value other than "1" ⇒ fail-closed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createRuntimeIdentityProvider,
  DevTestIdentityProvider,
  isDevTestIdentityEnabled,
} from "../lib/runtime-identity.ts";
import {
  createProductionIdentityProvider,
  UnconfiguredIdentityProvider,
} from "../lib/identity.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

function withEnv(vars, fn) {
  const prev = {};
  for (const key of Object.keys(vars)) {
    prev[key] = process.env[key];
    const value = vars[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(vars)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }
}

test("identity gate is closed when AB_ALLOW_TEST_IDENTITY is unset", () => {
  withEnv({ AB_ALLOW_TEST_IDENTITY: undefined, AB_FORCE_FAIL_CLOSED_IDENTITY: undefined }, () => {
    assert.equal(isDevTestIdentityEnabled(), false);
    assert.ok(createRuntimeIdentityProvider() instanceof UnconfiguredIdentityProvider);
  });
});

test("identity gate is closed for empty / non-1 values (DEV/TEST/Preview alike)", () => {
  for (const value of ["", "0", "true", "yes", "TRUE"]) {
    withEnv({ AB_ALLOW_TEST_IDENTITY: value, AB_FORCE_FAIL_CLOSED_IDENTITY: undefined }, () => {
      assert.equal(isDevTestIdentityEnabled(), false, `value=${JSON.stringify(value)}`);
      assert.ok(createRuntimeIdentityProvider() instanceof UnconfiguredIdentityProvider);
    });
  }
});

test("identity gate opens only for explicit AB_ALLOW_TEST_IDENTITY=1", () => {
  withEnv({ AB_ALLOW_TEST_IDENTITY: "1", AB_FORCE_FAIL_CLOSED_IDENTITY: undefined }, () => {
    assert.equal(isDevTestIdentityEnabled(), true);
    assert.ok(createRuntimeIdentityProvider() instanceof DevTestIdentityProvider);
  });
});

test("AB_FORCE_FAIL_CLOSED_IDENTITY overrides allow flag", () => {
  withEnv({ AB_ALLOW_TEST_IDENTITY: "1", AB_FORCE_FAIL_CLOSED_IDENTITY: "1" }, () => {
    assert.equal(isDevTestIdentityEnabled(), false);
    assert.ok(createRuntimeIdentityProvider() instanceof UnconfiguredIdentityProvider);
  });
});

test("vite.config does not default-enable TEST identity", () => {
  const source = readFileSync(join(repoRoot, "vite.config.ts"), "utf8");
  assert.doesNotMatch(source, /AB_ALLOW_TEST_IDENTITY/);
  assert.doesNotMatch(source, /localAllowTestIdentity/);
  assert.doesNotMatch(source, /NODE_ENV === ["']production["'].*"1"/);
});

test("hosting.json D1 binding is unchanged from fail-safe null in this patch scope", () => {
  const hosting = JSON.parse(readFileSync(join(repoRoot, ".openai/hosting.json"), "utf8"));
  assert.equal(hosting.d1, null);
});

test("production identity factory remains fail-closed Unconfigured", () => {
  assert.ok(createProductionIdentityProvider() instanceof UnconfiguredIdentityProvider);
});

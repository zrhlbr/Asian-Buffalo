/**
 * Runtime identity selection for API routes.
 *
 * - Default / production: fail-closed (UnconfiguredIdentityProvider).
 * - DEV/TEST only when AB_ALLOW_TEST_IDENTITY=1 (and never when
 *   AB_FORCE_FAIL_CLOSED_IDENTITY=1): DevTestIdentityProvider.
 *
 * Does not trust client headers, cookies, query, or body for identity.
 */

import {
  createProductionIdentityProvider,
  type IdentityProvider,
  type PlayerIdentity,
} from "./identity.ts";

export const DEV_TEST_PLAYER_ID = "dev-test-player";

function readEnv(name: string): string | undefined {
  try {
    const fromProcess = process.env[name];
    if (typeof fromProcess === "string" && fromProcess.length > 0) {
      return fromProcess;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export function isDevTestIdentityEnabled(): boolean {
  if (readEnv("AB_FORCE_FAIL_CLOSED_IDENTITY") === "1") return false;
  // Explicit allow-list only — production must omit this flag.
  return readEnv("AB_ALLOW_TEST_IDENTITY") === "1";
}

/**
 * Fixed DEV/TEST identity. Never reads request headers/body.
 * Production code paths must not construct this unless the gate passes.
 */
export class DevTestIdentityProvider implements IdentityProvider {
  readonly playerId: string;

  constructor(playerId: string = DEV_TEST_PLAYER_ID) {
    this.playerId = playerId;
  }

  async resolve(): Promise<PlayerIdentity> {
    return { playerId: this.playerId };
  }
}

export function createRuntimeIdentityProvider(): IdentityProvider {
  if (isDevTestIdentityEnabled()) {
    const playerId = readEnv("AB_TEST_PLAYER_ID")?.trim() || DEV_TEST_PLAYER_ID;
    return new DevTestIdentityProvider(playerId);
  }
  return createProductionIdentityProvider();
}

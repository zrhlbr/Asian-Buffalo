/**
 * Runtime identity selection for API routes.
 *
 * Resolution order:
 * 1. Valid player Auth session cookie/Bearer (`ab_player`) → session playerId
 * 2. DEV/TEST only when AB_ALLOW_TEST_IDENTITY=1 (and never when
 *    AB_FORCE_FAIL_CLOSED_IDENTITY=1): DevTestIdentityProvider
 * 3. Else fail-closed UnconfiguredIdentityProvider
 *
 * Session path does not trust client-supplied playerId fields.
 */

import {
  createProductionIdentityProvider,
  IdentityAuthError,
  type IdentityProvider,
  type PlayerIdentity,
} from "./identity.ts";
import { extractPlayerAccessToken } from "./player-session.ts";

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
 * Fixed DEV/TEST identity. Never reads request headers/body for player id.
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

/** Session-cookie identity — formal Auth path. */
export class PlayerSessionIdentityProvider implements IdentityProvider {
  async resolve(request: Request): Promise<PlayerIdentity> {
    // Cheap pre-check — avoid DB when no Auth cookie/Bearer present.
    if (!extractPlayerAccessToken(request)) {
      throw new IdentityAuthError();
    }
    try {
      // Dynamic import keeps unit tests that only need DevTest from loading D1.
      const { getDb } = await import("../db/index.ts");
      const { resolvePlayerSession } = await import("./player-session.ts");
      const db = await getDb();
      const session = await resolvePlayerSession(db, request);
      if (!session) {
        throw new IdentityAuthError();
      }
      return { playerId: session.playerId };
    } catch (error) {
      if (error instanceof IdentityAuthError) throw error;
      // DB/bootstrap failure → treat as unauthenticated so DevTest/fail-closed can apply.
      throw new IdentityAuthError();
    }
  }
}

/**
 * Composite: prefer Auth session; else DevTest when gated; else fail-closed.
 * Missing/invalid session does not throw when DevTest is available.
 */
export class RuntimeIdentityProvider implements IdentityProvider {
  readonly sessionProvider: IdentityProvider;
  readonly fallback: IdentityProvider;

  constructor(sessionProvider: IdentityProvider, fallback: IdentityProvider) {
    this.sessionProvider = sessionProvider;
    this.fallback = fallback;
  }

  async resolve(request: Request): Promise<PlayerIdentity> {
    try {
      return await this.sessionProvider.resolve(request);
    } catch (error) {
      if (!(error instanceof IdentityAuthError)) throw error;
    }
    return this.fallback.resolve(request);
  }
}

export function createRuntimeIdentityProvider(): IdentityProvider {
  const sessionProvider = new PlayerSessionIdentityProvider();
  if (isDevTestIdentityEnabled()) {
    const playerId = readEnv("AB_TEST_PLAYER_ID")?.trim() || DEV_TEST_PLAYER_ID;
    return new RuntimeIdentityProvider(
      sessionProvider,
      new DevTestIdentityProvider(playerId),
    );
  }
  return new RuntimeIdentityProvider(
    sessionProvider,
    createProductionIdentityProvider(),
  );
}

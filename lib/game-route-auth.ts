/**
 * Shared fail-closed identity + player bootstrap for game commerce routes.
 */

import { getDb } from "../db/index.ts";
import { getTrustedPlayerContext } from "./db-game.ts";
import {
  ensureDevTestPlayer,
} from "./dev-test-bootstrap.ts";
import {
  IdentityAuthError,
  IdentityUnavailableError,
} from "./identity.ts";
import { createRuntimeIdentityProvider } from "./runtime-identity.ts";
import { ensurePlayerCommerceReady } from "./player-commerce-bootstrap.ts";
import { touchLastLogin } from "./player-profile.ts";

export function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function resolveActivePlayer(request: Request): Promise<
  | { ok: true; db: Awaited<ReturnType<typeof getDb>>; playerId: string; currency: string }
  | { ok: false; response: Response }
> {
  const identityProvider = createRuntimeIdentityProvider();
  let playerId: string;
  try {
    ({ playerId } = await identityProvider.resolve(request));
  } catch (error) {
    if (error instanceof IdentityUnavailableError) {
      return { ok: false, response: jsonError("SERVICE_UNAVAILABLE", "Service temporarily unavailable", 503) };
    }
    if (error instanceof IdentityAuthError) {
      return { ok: false, response: jsonError("UNAUTHORIZED", "Authentication required", 401) };
    }
    throw error;
  }

  const db = await getDb();
  // DevTest harness only — Auth-registered players already exist in `players`.
  await ensureDevTestPlayer(db, playerId);
  await ensurePlayerCommerceReady(db);
  const context = await getTrustedPlayerContext(db, playerId);
  if (!context || context.status !== "ACTIVE") {
    return { ok: false, response: jsonError("PLAYER_UNAVAILABLE", "Player unavailable", 403) };
  }
  await touchLastLogin(db, context.playerId);
  return { ok: true, db, playerId: context.playerId, currency: context.currency };
}

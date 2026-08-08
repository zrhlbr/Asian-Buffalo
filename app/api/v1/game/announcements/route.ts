/**
 * Player announcements — PUBLISHED + schedule-filtered, trilingual locales.
 */
import { getDb } from "../../../../../db/index.ts";
import {
  createProductionIdentityProvider,
  IdentityAuthError,
  IdentityUnavailableError,
} from "../../../../../lib/identity.ts";
import { listPlayerAnnouncements } from "../../../../../lib/player-announcements.ts";
import { createRuntimeIdentityProvider } from "../../../../../lib/runtime-identity.ts";

function unavailable(): Response {
  return Response.json(
    { error: { code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable" } },
    { status: 503 },
  );
}

function unauthorized(): Response {
  return Response.json(
    { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
    { status: 401 },
  );
}

export async function GET(request: Request) {
  void createProductionIdentityProvider;
  const identityProvider = createRuntimeIdentityProvider();
  try {
    await identityProvider.resolve(request);
  } catch (error) {
    if (error instanceof IdentityUnavailableError) return unavailable();
    if (error instanceof IdentityAuthError) return unauthorized();
    throw error;
  }

  const db = await getDb();
  const items = await listPlayerAnnouncements(db);
  return Response.json({ items });
}

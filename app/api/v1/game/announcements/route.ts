/**
 * Player announcements — PUBLISHED + schedule-filtered, trilingual locales.
 * Public read for lobby ticker (no Auth required). Mutations remain Admin-only.
 */
import { getDb } from "../../../../../db/index.ts";
import { listPlayerAnnouncements } from "../../../../../lib/player-announcements.ts";

function unavailable(): Response {
  return Response.json(
    { error: { code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable" } },
    { status: 503 },
  );
}

export async function GET() {
  try {
    const db = await getDb();
    const items = await listPlayerAnnouncements(db);
    return Response.json({ items });
  } catch {
    return unavailable();
  }
}

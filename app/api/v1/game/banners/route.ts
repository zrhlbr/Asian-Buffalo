/**
 * Player banners — ACTIVE Content Center banners only.
 * Public read for Lobby (no Auth). Mutations remain Admin-only.
 */
import { getDb } from "../../../../../db/index.ts";
import { listPublicBanners } from "../../../../../lib/player-content.ts";

function unavailable(): Response {
  return Response.json(
    { error: { code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable" } },
    { status: 503 },
  );
}

export async function GET() {
  try {
    const db = await getDb();
    const items = await listPublicBanners(db);
    return Response.json({ items });
  } catch {
    return unavailable();
  }
}

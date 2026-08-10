/**
 * Player recommended games — enabled Content Center entries (official game IDs only).
 * Public read for Lobby (no Auth). Mutations remain Admin-only.
 */
import { getDb } from "../../../../../db/index.ts";
import { listPublicRecommendedGames } from "../../../../../lib/player-content.ts";

function unavailable(): Response {
  return Response.json(
    { error: { code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable" } },
    { status: 503 },
  );
}

export async function GET() {
  try {
    const db = await getDb();
    const items = await listPublicRecommendedGames(db);
    return Response.json({ items });
  } catch {
    return unavailable();
  }
}

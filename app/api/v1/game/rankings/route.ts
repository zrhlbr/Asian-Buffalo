import { resolveActivePlayer } from "../../../../../lib/game-route-auth.ts";
import {
  listWinRankings,
  parseRankingRange,
} from "../../../../../lib/rankings-service.ts";

/** GET /api/v1/game/rankings?range=today|7d|30d&limit=&offset= */
export async function GET(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const range = parseRankingRange(url.searchParams.get("range"));
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const result = await listWinRankings(auth.db, { range, limit, offset });
  return Response.json(result, {
    headers: {
      "Cache-Control": `private, max-age=${result.cacheTtlSeconds}`,
    },
  });
}

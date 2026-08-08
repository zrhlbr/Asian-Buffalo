import { resolveActivePlayer } from "../../../../../lib/game-route-auth.ts";
import { listPlayerWins } from "../../../../../lib/win-history.ts";

export async function GET(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const result = await listPlayerWins(auth.db, auth.playerId, { limit, offset });
  return Response.json(result);
}

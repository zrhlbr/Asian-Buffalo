import { resolveActivePlayer, jsonError } from "../../../../../lib/game-route-auth.ts";
import { getPlayerVip } from "../../../../../lib/vip-service.ts";

export async function GET(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const vip = await getPlayerVip(auth.db, auth.playerId);
  return Response.json({ vip });
}

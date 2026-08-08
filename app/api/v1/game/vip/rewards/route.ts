import { resolveActivePlayer } from "../../../../../../lib/game-route-auth.ts";
import { listRewardChests } from "../../../../../../lib/vip-rewards.ts";

export async function GET(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const chests = await listRewardChests(auth.db, auth.playerId);
  return Response.json({ chests });
}

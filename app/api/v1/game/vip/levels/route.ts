import { resolveActivePlayer } from "../../../../../../lib/game-route-auth.ts";
import { getPlayerVip, listVipLevelConfig } from "../../../../../../lib/vip-service.ts";

export async function GET(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const [vip, config] = await Promise.all([
    getPlayerVip(auth.db, auth.playerId),
    listVipLevelConfig(auth.db),
  ]);
  return Response.json({ vip, levels: vip.levels, config });
}

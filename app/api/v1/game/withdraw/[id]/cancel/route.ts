import { resolveActivePlayer, jsonError } from "../../../../../../../lib/game-route-auth.ts";
import { cancelWithdrawal } from "../../../../../../../lib/withdrawal-service.ts";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (!id) return jsonError("INVALID_REQUEST", "id required", 400);
  const result = await cancelWithdrawal(auth.db, {
    id,
    playerId: auth.playerId,
  });
  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 400;
    return jsonError(result.code, result.message, status);
  }
  return Response.json({ request: result.request });
}

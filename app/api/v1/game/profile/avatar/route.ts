import { resolveActivePlayer, jsonError } from "../../../../../../lib/game-route-auth.ts";
import { updateAvatar } from "../../../../../../lib/player-profile.ts";

export async function POST(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const avatarId = typeof body?.avatarId === "string" ? body.avatarId : "";
  if (!avatarId) return jsonError("INVALID_REQUEST", "avatarId is required", 400);
  const result = await updateAvatar(auth.db, auth.playerId, avatarId);
  if (!result.ok) return jsonError(result.code, result.message, 400);
  return Response.json({ profile: result.profile });
}

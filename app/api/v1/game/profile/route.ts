/**
 * Player profile GET / PATCH — nickname only on PATCH.
 * Balance is never accepted or mutated here.
 */
import { resolveActivePlayer, jsonError } from "../../../../../lib/game-route-auth.ts";
import {
  getPlayerProfile,
  listAvatarCatalog,
  updateNickname,
} from "../../../../../lib/player-profile.ts";

export async function GET(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const profile = await getPlayerProfile(auth.db, auth.playerId);
  if (!profile) return jsonError("PLAYER_UNAVAILABLE", "Player unavailable", 403);
  return Response.json({
    profile,
    avatars: listAvatarCatalog(),
  });
}

export async function PATCH(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.nickname !== "string") {
    return jsonError("INVALID_REQUEST", "nickname is required", 400);
  }
  // Reject any client balance fields — fail closed
  if ("balance" in body || "balanceMinor" in body || "amountMinor" in body) {
    return jsonError("FORBIDDEN_FIELD", "Balance cannot be mutated via profile", 400);
  }
  const result = await updateNickname(auth.db, auth.playerId, body.nickname);
  if (!result.ok) return jsonError(result.code, result.message, 400);
  return Response.json({ profile: result.profile });
}

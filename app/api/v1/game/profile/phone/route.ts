/**
 * Phone bind/update — E.164 validation stub.
 * SMS OTP vendor is BUSINESS_RULES_PENDING BR-004.
 */
import { resolveActivePlayer, jsonError } from "../../../../../../lib/game-route-auth.ts";
import { updatePhone } from "../../../../../../lib/player-profile.ts";

export async function POST(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const phone = typeof body?.phoneE164 === "string" ? body.phoneE164 : "";
  if (!phone) return jsonError("INVALID_REQUEST", "phoneE164 is required", 400);
  const result = await updatePhone(auth.db, auth.playerId, phone);
  if (!result.ok) return jsonError(result.code, result.message, 400);
  return Response.json({
    profile: result.profile,
    pending: { smsOtp: "BR-004", message: "SMS verification pending business rules" },
  });
}

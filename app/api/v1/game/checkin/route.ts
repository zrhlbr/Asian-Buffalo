import { resolveActivePlayer, jsonError } from "../../../../../lib/game-route-auth.ts";
import { claimCheckin, getCheckinStatus } from "../../../../../lib/activity-service.ts";

export async function GET(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const status = await getCheckinStatus(auth.db, auth.playerId);
  return Response.json({ checkin: status });
}

export async function POST(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (body && ("amountMinor" in body || "balanceMinor" in body)) {
    return jsonError("FORBIDDEN_FIELD", "Client cannot set check-in amount or balance", 400);
  }
  const result = await claimCheckin(auth.db, auth.playerId);
  if (!result.ok) {
    return jsonError(result.code, result.message, 400);
  }
  return Response.json({ claim: result });
}

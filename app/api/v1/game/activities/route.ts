import { resolveActivePlayer, jsonError } from "../../../../../lib/game-route-auth.ts";
import { claimActivity, listActivities } from "../../../../../lib/activity-service.ts";

export async function GET(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const items = await listActivities(auth.db, auth.playerId);
  return Response.json({ items });
}

export async function POST(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const activityId = typeof body?.activityId === "string" ? body.activityId : "";
  if (!activityId) return jsonError("INVALID_REQUEST", "activityId required", 400);
  if (body && ("amountMinor" in body || "balanceMinor" in body)) {
    return jsonError("FORBIDDEN_FIELD", "Client cannot set reward amount or balance", 400);
  }
  const result = await claimActivity(auth.db, auth.playerId, activityId);
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "EXPIRED" ? 410 : 400;
    return jsonError(result.code, result.message, status);
  }
  return Response.json({ claim: result });
}

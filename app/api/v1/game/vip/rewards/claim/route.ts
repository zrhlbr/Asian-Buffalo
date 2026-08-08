/**
 * Claim VIP reward — MoneyService.credit + claim idempotency.
 * Rejects client-supplied amountMinor (server uses vip_reward_defs only).
 */
import { resolveActivePlayer, jsonError } from "../../../../../../../lib/game-route-auth.ts";
import { claimRewardChest } from "../../../../../../../lib/vip-rewards.ts";

export async function POST(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const rewardDefId = typeof body?.rewardDefId === "string" ? body.rewardDefId : "";
  if (!rewardDefId) return jsonError("INVALID_REQUEST", "rewardDefId is required", 400);
  if ("amountMinor" in (body ?? {}) || "balanceMinor" in (body ?? {})) {
    return jsonError("FORBIDDEN_FIELD", "Client cannot set reward amount or balance", 400);
  }
  const idem =
    typeof body?.idempotencyKey === "string" ? body.idempotencyKey : undefined;
  const result = await claimRewardChest(auth.db, auth.playerId, rewardDefId, idem);
  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "ALREADY_CLAIMED" ? 409 : 400;
    return jsonError(result.code, result.message, status);
  }
  return Response.json({
    claim: result,
    // Client must refresh balance from wallet API — never trust local math alone
  });
}

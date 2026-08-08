/**
 * Deposit orders — create + list. Amount from presets only.
 */
import { resolveActivePlayer, jsonError } from "../../../../../lib/game-route-auth.ts";
import {
  createDepositOrder,
  listPlayerDeposits,
} from "../../../../../lib/deposit-service.ts";

export async function GET(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const items = await listPlayerDeposits(auth.db, auth.playerId, 30);
  return Response.json({ items });
}

export async function POST(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("INVALID_REQUEST", "JSON body required", 400);
  if ("balanceMinor" in body || "status" in body) {
    return jsonError("FORBIDDEN_FIELD", "Client cannot set balance or status", 400);
  }
  const channelCode = typeof body.channelCode === "string" ? body.channelCode.trim() : "";
  const amountMinor = Number(body.amountMinor);
  const idempotencyKey =
    typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  if (!channelCode || !idempotencyKey) {
    return jsonError("INVALID_REQUEST", "channelCode and idempotencyKey required", 400);
  }
  const result = await createDepositOrder(auth.db, {
    playerId: auth.playerId,
    currency: auth.currency,
    channelCode,
    amountMinor,
    idempotencyKey,
  });
  if (!result.ok) {
    return jsonError(result.code, result.message, 400);
  }
  return Response.json({ order: result.order, alreadyExists: result.alreadyExists ?? false }, {
    status: result.alreadyExists ? 200 : 201,
  });
}

import { resolveActivePlayer, jsonError } from "../../../../../lib/game-route-auth.ts";
import {
  createWithdrawalRequest,
  getWithdrawalConfig,
  listPlayerWithdrawals,
} from "../../../../../lib/withdrawal-service.ts";
import {
  getPaymentCommerceReadiness,
  listPaymentChannels,
} from "../../../../../lib/deposit-service.ts";

export async function GET(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const config = await getWithdrawalConfig(auth.db);
  const channels = await listPaymentChannels(auth.db, {
    currency: auth.currency,
    enabledOnly: true,
  });
  const items = await listPlayerWithdrawals(auth.db, auth.playerId, 30);
  const readiness = await getPaymentCommerceReadiness(auth.db);
  return Response.json({ config, channels, items, readiness });
}

export async function POST(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("INVALID_REQUEST", "JSON body required", 400);
  if ("balanceMinor" in body || "status" in body || "feeMinor" in body) {
    return jsonError("FORBIDDEN_FIELD", "Client cannot set balance, fee, or status", 400);
  }
  const channelCode = typeof body.channelCode === "string" ? body.channelCode.trim() : "";
  const account = typeof body.account === "string" ? body.account : "";
  const amountMinor = Number(body.amountMinor);
  const idempotencyKey =
    typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  if (!channelCode || !account || !idempotencyKey) {
    return jsonError(
      "INVALID_REQUEST",
      "channelCode, account, and idempotencyKey required",
      400,
    );
  }
  const result = await createWithdrawalRequest(auth.db, {
    playerId: auth.playerId,
    currency: auth.currency,
    channelCode,
    account,
    amountMinor,
    idempotencyKey,
  });
  if (!result.ok) {
    const status = result.code === "INSUFFICIENT_BALANCE" ? 409 : 400;
    return jsonError(result.code, result.message, status);
  }
  return Response.json(
    { request: result.request, alreadyExists: result.alreadyExists ?? false },
    { status: result.alreadyExists ? 200 : 201 },
  );
}

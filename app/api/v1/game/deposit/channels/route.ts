import { resolveActivePlayer, jsonError } from "../../../../../../lib/game-route-auth.ts";
import {
  getDepositConfig,
  getPaymentCommerceReadiness,
  listPaymentChannels,
} from "../../../../../../lib/deposit-service.ts";

export async function GET(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const cfg = await getDepositConfig(auth.db);
  const channels = await listPaymentChannels(auth.db, {
    currency: auth.currency,
    enabledOnly: true,
  });
  const readiness = await getPaymentCommerceReadiness(auth.db);
  return Response.json({
    currency: auth.currency,
    config: cfg,
    channels,
    readiness,
  });
}

export async function POST() {
  return jsonError("METHOD_NOT_ALLOWED", "Channels are read-only for players", 405);
}

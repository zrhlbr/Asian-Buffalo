/**
 * Test / provider confirm harness for deposits.
 * Credits via MoneyService using order amount only (never client amount as source of truth).
 */
import { resolveActivePlayer, jsonError } from "../../../../../../lib/game-route-auth.ts";
import { confirmDepositOrder } from "../../../../../../lib/deposit-service.ts";
import { isDevTestIdentityEnabled } from "../../../../../../lib/runtime-identity.ts";

export async function POST(request: Request) {
  if (!isDevTestIdentityEnabled()) {
    // Production provider callbacks should use a signed provider endpoint (future).
    // Fail closed until provider secrets exist (BR-007).
    return jsonError(
      "PROVIDER_NOT_CONFIGURED",
      "Live provider callback not configured (BR-007); test confirm requires AB_ALLOW_TEST_IDENTITY",
      503,
    );
  }
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("INVALID_REQUEST", "JSON body required", 400);
  if ("amountMinor" in body || "balanceMinor" in body) {
    return jsonError("FORBIDDEN_FIELD", "Client cannot set credit amount or balance", 400);
  }
  const orderId = typeof body.orderId === "string" ? body.orderId : undefined;
  const providerRef = typeof body.providerRef === "string" ? body.providerRef : undefined;
  const result = await confirmDepositOrder(auth.db, {
    orderId,
    providerRef,
    playerId: auth.playerId,
  });
  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 400;
    return jsonError(result.code, result.message, status);
  }
  return Response.json({
    order: result.order,
    alreadyCredited: result.alreadyCredited ?? false,
    balanceAfterMinor: result.balanceAfterMinor,
  });
}

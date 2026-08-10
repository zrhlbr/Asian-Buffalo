/**
 * Formal balance read — D1 ledger PLAYER_AVAILABLE (same stack as spins).
 * Uses the same fail-closed runtime identity gate as other game routes.
 */
import { getDb } from "../../../../../../db/index.ts";
import { getTrustedPlayerContext } from "../../../../../../lib/db-game.ts";
import {
  createProductionIdentityProvider,
  IdentityAuthError,
  IdentityUnavailableError,
} from "../../../../../../lib/identity.ts";
import {
  ensureDevTestPlayer,
  seedDevTestWalletIfEmpty,
} from "../../../../../../lib/dev-test-bootstrap.ts";
import { createRuntimeIdentityProvider } from "../../../../../../lib/runtime-identity.ts";
import { createRouteDbWalletAdapter } from "../../../../../../lib/route-money-services.ts";

function unavailable(): Response {
  return Response.json(
    { error: { code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable" } },
    { status: 503 },
  );
}

function unauthorized(): Response {
  return Response.json(
    { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
    { status: 401 },
  );
}

export async function GET(request: Request) {
  void createProductionIdentityProvider;
  const identityProvider = createRuntimeIdentityProvider();

  let playerId: string;
  try {
    ({ playerId } = await identityProvider.resolve(request));
  } catch (error) {
    if (error instanceof IdentityUnavailableError) return unavailable();
    if (error instanceof IdentityAuthError) return unauthorized();
    throw error;
  }

  const db = await getDb();
  await ensureDevTestPlayer(db, playerId);
  const context = await getTrustedPlayerContext(db, playerId);
  if (!context || context.status !== "ACTIVE") {
    return Response.json(
      { error: { code: "PLAYER_UNAVAILABLE", message: "Player unavailable" } },
      { status: 403 },
    );
  }

  const walletAdapter = createRouteDbWalletAdapter(db);
  const balanceMinor = await seedDevTestWalletIfEmpty(
    walletAdapter,
    context.playerId,
    context.currency,
  );

  return Response.json({
    playerId: context.playerId,
    currency: context.currency,
    balanceMinor,
  });
}

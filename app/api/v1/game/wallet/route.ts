/**
 * Wallet snapshot — available / frozen / recent moves.
 * Balance never accepted from client.
 */
import { resolveActivePlayer, jsonError } from "../../../../../lib/game-route-auth.ts";
import { getWalletSnapshot } from "../../../../../lib/wallet-commerce-service.ts";
import {
  ensureDevTestPlayer,
  seedDevTestWalletIfEmpty,
} from "../../../../../lib/dev-test-bootstrap.ts";
import { createRouteDbWalletAdapter } from "../../../../../lib/route-money-services.ts";

export async function GET(request: Request) {
  const auth = await resolveActivePlayer(request);
  if (!auth.ok) return auth.response;
  await ensureDevTestPlayer(auth.db, auth.playerId);
  const walletAdapter = createRouteDbWalletAdapter(auth.db);
  await seedDevTestWalletIfEmpty(walletAdapter, auth.playerId, auth.currency);
  const wallet = await getWalletSnapshot(auth.db, auth.playerId, auth.currency);
  return Response.json({ wallet });
}

export async function POST() {
  return jsonError("METHOD_NOT_ALLOWED", "Wallet is read-only; use deposit/withdraw APIs", 405);
}

export async function PATCH() {
  return jsonError("METHOD_NOT_ALLOWED", "Client cannot mutate wallet balance", 405);
}

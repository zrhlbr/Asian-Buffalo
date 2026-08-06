import { getDb } from "../../../../../db/index.ts";
import {
  createProductionIdentityProvider,
  handleSpin,
} from "../../../../../lib/api-handlers.ts";
import {
  ensureDevTestPlayer,
  seedDevTestWalletIfEmpty,
} from "../../../../../lib/dev-test-bootstrap.ts";
import {
  createRuntimeIdentityProvider,
  DEV_TEST_PLAYER_ID,
} from "../../../../../lib/runtime-identity.ts";
import {
  routeTestRoundStore,
  routeTestWalletAdapter,
} from "../../../../../lib/route-test-services.ts";

/**
 * Local/TEST wallet for playable spins when identity gate is explicitly open.
 * allowRealMoney stays false. Identity fail-closed unless AB_ALLOW_TEST_IDENTITY=1.
 */
const walletAdapter = routeTestWalletAdapter;
const roundStore = routeTestRoundStore;

export async function POST(request: Request) {
  void createProductionIdentityProvider;
  const db = await getDb();
  const identityProvider = createRuntimeIdentityProvider();
  const player = await ensureDevTestPlayer(db, DEV_TEST_PLAYER_ID);
  if (player) {
    await seedDevTestWalletIfEmpty(walletAdapter, player.playerId, player.currency);
  }
  const payload = await request.json().catch(() => null);
  return handleSpin(
    db,
    { identityProvider, request },
    { walletAdapter, roundStore, allowRealMoney: false },
    payload,
  );
}

import { getDb } from "../../../../../db/index.ts";
import {
  createProductionIdentityProvider,
  handleCreateSession,
} from "../../../../../lib/api-handlers.ts";
import { ensureDevTestPlayer } from "../../../../../lib/dev-test-bootstrap.ts";
import {
  createRuntimeIdentityProvider,
  DEV_TEST_PLAYER_ID,
} from "../../../../../lib/runtime-identity.ts";

/**
 * Identity: createRuntimeIdentityProvider() — fail-closed unless
 * AB_ALLOW_TEST_IDENTITY=1 is explicitly set. Production factory remains
 * the fallback (see createProductionIdentityProvider).
 */
export async function POST(request: Request) {
  void createProductionIdentityProvider;
  const db = await getDb();
  const identityProvider = createRuntimeIdentityProvider();
  await ensureDevTestPlayer(db, DEV_TEST_PLAYER_ID);
  const payload = await request.json().catch(() => null);
  return handleCreateSession(db, { identityProvider, request }, payload);
}

import { getDb } from "../../../../../db/index.ts";
import {
  createProductionIdentityProvider,
  handleSpin,
} from "../../../../../lib/api-handlers.ts";
import { TestRoundStore } from "../../../../../lib/round-store.ts";
import { TestWalletAdapter } from "../../../../../lib/wallet-adapter.ts";

/**
 * Test-only wallet adapter. This endpoint does not connect to a production
 * wallet; real-money settlement is disabled by the math configuration.
 * Identity uses the fail-closed production provider until formal auth is wired.
 */
const walletAdapter = new TestWalletAdapter();
const roundStore = new TestRoundStore();
const identityProvider = createProductionIdentityProvider();

export async function POST(request: Request) {
  const db = await getDb();
  const payload = await request.json().catch(() => null);
  return handleSpin(
    db,
    { identityProvider, request },
    { walletAdapter, roundStore, allowRealMoney: false },
    payload,
  );
}

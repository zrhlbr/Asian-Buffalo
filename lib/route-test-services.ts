/**
 * Shared TEST wallet + round store for local API routes (same worker isolate).
 * Not a production wallet; REAL money remains fail-closed via allowRealMoney=false.
 */

import { TestRoundStore } from "./round-store.ts";
import { TestWalletAdapter } from "./wallet-adapter.ts";

export const routeTestWalletAdapter = new TestWalletAdapter();
export const routeTestRoundStore = new TestRoundStore();

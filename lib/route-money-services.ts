/**
 * Formal route money stack: D1 Intent + Provider + Ledger via MoneyService.
 * allowRealMoney stays false on public spin routes (TEST wallet mode).
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";
import { DbWalletAdapter } from "./db-wallet-adapter.ts";
import { D1IntentStore, D1Ledger, D1ProviderStore } from "./d1-money-stores.ts";
import { MoneyService } from "./money-service.ts";
import { TestRoundStore } from "./round-store.ts";

type AppDb = DrizzleD1Database<typeof schema>;

/** Per-request MoneyService bound to D1 (durable wallet/ledger). */
export function createRouteMoneyService(db: AppDb): MoneyService {
  return new MoneyService({
    mode: "TEST",
    ledger: new D1Ledger(db),
    intents: new D1IntentStore(db),
    providers: new D1ProviderStore(db),
  });
}

export function createRouteDbWalletAdapter(db: AppDb): DbWalletAdapter {
  return new DbWalletAdapter(createRouteMoneyService(db));
}

/** Round presentation cache remains in-memory (round truth is game_rounds). */
export const routeRoundStore = new TestRoundStore();

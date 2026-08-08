/**
 * DEV/TEST bootstrap helpers for local playability.
 * Fail-closed when AB_ALLOW_TEST_IDENTITY is not set.
 * Seeds via WalletAdapter public methods only (Test or Db/D1).
 */

import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema.ts";
import { ensureDevLocalSchema } from "./dev-schema-bootstrap.ts";
import { DEV_TEST_PLAYER_ID, isDevTestIdentityEnabled } from "./runtime-identity.ts";
import type { TestWalletAdapter } from "./wallet-adapter.ts";

const DEFAULT_CURRENCY = "MMK";
const DEFAULT_SEED_MINOR = 100_000;

type SeedableWallet = {
  getAvailableBalance(playerId: string, currency: string): Promise<number>;
  creditAvailable(
    playerId: string,
    currency: string,
    amountMinor: number,
  ): void | Promise<void>;
};

export async function ensureDevTestPlayer(
  db: DrizzleD1Database<typeof schema>,
  playerId: string = DEV_TEST_PLAYER_ID,
  currency: string = DEFAULT_CURRENCY,
): Promise<{ playerId: string; currency: string } | null> {
  if (!isDevTestIdentityEnabled()) return null;
  await ensureDevLocalSchema(db);

  const existing = await db.query.players.findFirst({
    where: eq(schema.players.id, playerId),
  });
  if (existing) {
    return { playerId: existing.id, currency: existing.currency };
  }

  await db.insert(schema.players).values({
    id: playerId,
    walletAdapterRef: `wallet_${playerId}`,
    currency,
    status: "ACTIVE",
  });
  return { playerId, currency };
}

export function ensureDevTestWalletSeed(
  wallet: TestWalletAdapter,
  playerId: string,
  currency: string,
  amountMinor: number = DEFAULT_SEED_MINOR,
): void {
  if (!isDevTestIdentityEnabled()) return;
  void wallet.getAvailableBalance(playerId, currency).then((bal) => {
    if (bal <= 0) {
      wallet.creditAvailable(playerId, currency, amountMinor);
    }
  });
}

/**
 * Sync seed for request path (avoid race before first spin).
 * Only the fixed DevTest player id may receive the harness seed —
 * Auth-registered players must never get fake balances.
 */
export async function seedDevTestWalletIfEmpty(
  wallet: SeedableWallet,
  playerId: string,
  currency: string,
  amountMinor: number = DEFAULT_SEED_MINOR,
): Promise<number> {
  if (!isDevTestIdentityEnabled()) {
    return wallet.getAvailableBalance(playerId, currency);
  }
  const bal = await wallet.getAvailableBalance(playerId, currency);
  const allowedTestId =
    (typeof process !== "undefined" && process.env.AB_TEST_PLAYER_ID?.trim()) ||
    DEV_TEST_PLAYER_ID;
  if (playerId !== allowedTestId) {
    return bal;
  }
  if (bal <= 0) {
    await wallet.creditAvailable(playerId, currency, amountMinor);
    return amountMinor;
  }
  return bal;
}

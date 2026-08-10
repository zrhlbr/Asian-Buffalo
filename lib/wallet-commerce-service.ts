/**
 * Player wallet snapshot — single source for lobby / hub / slot HUD refresh.
 * available = ledger PLAYER_AVAILABLE; frozen = open withdrawal holds.
 * Never accepts client balance writes.
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";
import { createRouteMoneyService } from "./route-money-services.ts";
import { ensureWalletCommerceReady } from "./wallet-commerce-bootstrap.ts";
import { sumFrozenWithdrawals } from "./withdrawal-service.ts";
import { listPlayerDeposits } from "./deposit-service.ts";
import { listPlayerWithdrawals } from "./withdrawal-service.ts";

type AppDb = DrizzleD1Database<typeof schema>;

export type WalletMove = {
  id: string;
  kind: "DEPOSIT" | "WITHDRAWAL" | "REWARD" | "CHECKIN" | "ACTIVITY" | "LEDGER";
  status: string;
  amountMinor: number;
  currency: string;
  createdAt: string;
  label: string;
};

export type WalletSnapshot = {
  playerId: string;
  currency: string;
  availableMinor: number;
  frozenMinor: number;
  status: "ACTIVE" | "FROZEN_HOLDS" | "EMPTY";
  supportedCurrencies: string[];
  usdtSupported: boolean;
  recentMoves: WalletMove[];
};

export async function getWalletSnapshot(
  db: AppDb,
  playerId: string,
  currency: string,
  moneyService?: ReturnType<typeof createRouteMoneyService>,
): Promise<WalletSnapshot> {
  await ensureWalletCommerceReady(db);
  const money = moneyService ?? createRouteMoneyService(db);
  const availableMinor = await money.getAvailableBalance(playerId, currency);
  const frozenMinor = await sumFrozenWithdrawals(db, playerId, currency);

  const deposits = await listPlayerDeposits(db, playerId, 10);
  const withdrawals = await listPlayerWithdrawals(db, playerId, 10);

  const rewardClaims = await db.all<Record<string, unknown>>(sql`
    SELECT id, amount_minor, currency, status, claimed_at
    FROM vip_reward_claims
    WHERE player_id = ${playerId}
    ORDER BY claimed_at DESC LIMIT 10
  `);

  const checkins = await db.all<Record<string, unknown>>(sql`
    SELECT id, amount_minor, currency, status, claimed_at
    FROM checkin_claims
    WHERE player_id = ${playerId}
    ORDER BY claimed_at DESC LIMIT 10
  `);

  const activities = await db.all<Record<string, unknown>>(sql`
    SELECT id, amount_minor, currency, status, claimed_at
    FROM activity_claims
    WHERE player_id = ${playerId}
    ORDER BY claimed_at DESC LIMIT 10
  `);

  const moves: WalletMove[] = [
    ...deposits.map((d) => ({
      id: d.id,
      kind: "DEPOSIT" as const,
      status: d.status,
      amountMinor: d.amountMinor,
      currency: d.currency,
      createdAt: d.createdAt,
      label: `Deposit ${d.channelCode}`,
    })),
    ...withdrawals.map((w) => ({
      id: w.id,
      kind: "WITHDRAWAL" as const,
      status: w.status,
      amountMinor: w.amountMinor,
      currency: w.currency,
      createdAt: w.createdAt,
      label: `Withdraw ${w.channelCode}`,
    })),
    ...rewardClaims.map((r) => ({
      id: String(r.id),
      kind: "REWARD" as const,
      status: String(r.status),
      amountMinor: Number(r.amount_minor),
      currency: String(r.currency),
      createdAt: String(r.claimed_at),
      label: "VIP reward",
    })),
    ...checkins.map((r) => ({
      id: String(r.id),
      kind: "CHECKIN" as const,
      status: String(r.status),
      amountMinor: Number(r.amount_minor),
      currency: String(r.currency),
      createdAt: String(r.claimed_at),
      label: "Check-in",
    })),
    ...activities.map((r) => ({
      id: String(r.id),
      kind: "ACTIVITY" as const,
      status: String(r.status),
      amountMinor: Number(r.amount_minor),
      currency: String(r.currency),
      createdAt: String(r.claimed_at),
      label: "Activity",
    })),
  ]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 20);

  // USDT listed only when an enabled TRC20 (or USDT) channel exists — BR-009
  const usdtRows = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM payment_channels
    WHERE currency = 'USDT' AND enabled = 1
  `);
  const usdtSupported = Number(usdtRows[0]?.n ?? 0) > 0;

  return {
    playerId,
    currency,
    availableMinor,
    frozenMinor,
    status: frozenMinor > 0 ? "FROZEN_HOLDS" : availableMinor > 0 ? "ACTIVE" : "EMPTY",
    supportedCurrencies: usdtSupported ? [currency, "USDT"].filter((v, i, a) => a.indexOf(v) === i) : [currency],
    usdtSupported,
    recentMoves: moves,
  };
}

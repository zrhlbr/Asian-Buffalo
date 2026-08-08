/**
 * Player win history — read-only projection of game_rounds (Spin/Round RO).
 * Never mutates wallet / round settlement.
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";

type AppDb = DrizzleD1Database<typeof schema>;

export type WinHistoryItem = {
  roundId: string;
  sessionId: string | null;
  status: string;
  betMinor: number;
  winMinor: number;
  currency: string;
  createdAt: string;
};

export async function listPlayerWins(
  db: AppDb,
  playerId: string,
  opts?: { limit?: number; offset?: number },
): Promise<{ items: WinHistoryItem[]; total: number }> {
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 100);
  const offset = Math.max(opts?.offset ?? 0, 0);

  const totalRows = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM game_rounds WHERE player_id = ${playerId}
  `);

  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT r.id, r.session_id, r.status, r.total_bet_minor, r.total_win_minor,
           r.created_at, p.currency
    FROM game_rounds r
    JOIN players p ON p.id = r.player_id
    WHERE r.player_id = ${playerId}
    ORDER BY r.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return {
    total: Number(totalRows[0]?.n ?? 0),
    items: rows.map((r) => ({
      roundId: String(r.id),
      sessionId: r.session_id ? String(r.session_id) : null,
      status: String(r.status),
      betMinor: Number(r.total_bet_minor ?? 0),
      winMinor: Number(r.total_win_minor ?? 0),
      currency: String(r.currency ?? "MMK"),
      createdAt: String(r.created_at),
    })),
  };
}

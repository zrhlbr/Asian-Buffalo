/**
 * Hub rankings — read-only aggregates from game_rounds (SETTLED wins).
 * Privacy: nicknames masked. No wallet/ledger writes.
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";

type AppDb = DrizzleD1Database<typeof schema>;

export type RankingRange = "today" | "7d" | "30d";

export type RankingItem = {
  rank: number;
  playerIdMasked: string;
  nicknameMasked: string;
  winAmountMinor: number;
  currency: string;
  game: string;
  range: RankingRange;
};

const GAME_CODE = "bull-demon-king";
const CACHE_TTL_MS = 30_000;

type CacheEntry = { expiresAt: number; payload: RankingListResult };
const cache = new Map<string, CacheEntry>();

export type RankingListResult = {
  range: RankingRange;
  game: string;
  total: number;
  limit: number;
  offset: number;
  generatedAt: string;
  cacheTtlSeconds: number;
  items: RankingItem[];
};

export function parseRankingRange(raw: string | null | undefined): RankingRange {
  if (raw === "today" || raw === "7d" || raw === "30d") return raw;
  return "7d";
}

export function maskNickname(nickname: string | null | undefined, playerId: string): string {
  const base = (nickname && nickname.trim()) || playerId;
  const chars = [...base];
  if (chars.length <= 2) return `${chars[0] ?? "*"}*`;
  if (chars.length <= 4) return `${chars[0]}**${chars[chars.length - 1]}`;
  return `${chars.slice(0, 2).join("")}***${chars.slice(-2).join("")}`;
}

export function maskPlayerId(playerId: string): string {
  if (playerId.length <= 4) return `p***`;
  return `${playerId.slice(0, 2)}***${playerId.slice(-2)}`;
}

function rangeStartIso(range: RankingRange, now = new Date()): string {
  if (range === "today") {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const ms = range === "7d" ? 7 * 86_400_000 : 30 * 86_400_000;
  return new Date(now.getTime() - ms).toISOString();
}

export function resetRankingsCacheForTests(): void {
  cache.clear();
}

export async function listWinRankings(
  db: AppDb,
  opts?: {
    range?: RankingRange;
    limit?: number;
    offset?: number;
    game?: string;
    now?: Date;
    bypassCache?: boolean;
  },
): Promise<RankingListResult> {
  const range = opts?.range ?? "7d";
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 100);
  const offset = Math.max(opts?.offset ?? 0, 0);
  const game = opts?.game ?? GAME_CODE;
  const cacheKey = `${game}:${range}:${limit}:${offset}`;

  if (!opts?.bypassCache) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) return hit.payload;
  }

  const since = rangeStartIso(range, opts?.now ?? new Date());

  const totalRows = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM (
      SELECT r.player_id AS player_id
      FROM game_rounds r
      WHERE r.status = 'SETTLED'
        AND COALESCE(r.total_win_minor, 0) > 0
        AND r.created_at >= ${since}
      GROUP BY r.player_id
    ) AS ranked_players
  `);

  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT r.player_id AS player_id,
           COALESCE(SUM(r.total_win_minor), 0) AS win_amount,
           MAX(p.currency) AS currency,
           MAX(pf.nickname) AS nickname
    FROM game_rounds r
    JOIN players p ON p.id = r.player_id
    LEFT JOIN player_profiles pf ON pf.player_id = r.player_id
    WHERE r.status = 'SETTLED'
      AND COALESCE(r.total_win_minor, 0) > 0
      AND r.created_at >= ${since}
    GROUP BY r.player_id
    ORDER BY win_amount DESC, player_id ASC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const items: RankingItem[] = rows.map((row, index) => {
    const playerId = String(row.player_id);
    return {
      rank: offset + index + 1,
      playerIdMasked: maskPlayerId(playerId),
      nicknameMasked: maskNickname(
        row.nickname ? String(row.nickname) : null,
        playerId,
      ),
      winAmountMinor: Number(row.win_amount ?? 0),
      currency: String(row.currency ?? "MMK"),
      game,
      range,
    };
  });

  const payload: RankingListResult = {
    range,
    game,
    total: Number(totalRows[0]?.n ?? 0),
    limit,
    offset,
    generatedAt: new Date().toISOString(),
    cacheTtlSeconds: Math.floor(CACHE_TTL_MS / 1000),
    items,
  };

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
  return payload;
}

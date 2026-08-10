/**
 * Player-facing Content Center readers (banners + recommended games).
 * Same tables as Admin Content Center — no hardcoded lobby CMS.
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";
import { ensureAdminSchema } from "./admin/admin-bootstrap.ts";
import {
  listPlayerBanners,
  listPlayerRecommendedGames,
  type BannerRow,
  type RecommendedGameRow,
} from "./admin/admin-content.ts";
import type { AdminDb } from "./admin/admin-queries.ts";

type AppDb = DrizzleD1Database<typeof schema>;

export async function listPublicBanners(db: AppDb): Promise<
  Array<{
    id: string;
    title: string;
    locales: BannerRow["locales"];
    imageUrl: string;
    targetUrl: string | null;
    textStrategy: BannerRow["textStrategy"];
    version: number;
  }>
> {
  await ensureAdminSchema(db);
  const items = await listPlayerBanners(db as unknown as AdminDb);
  return items.map((b) => ({
    id: b.id,
    title: b.title,
    locales: b.locales,
    imageUrl: b.imageUrl,
    targetUrl: b.targetUrl,
    textStrategy: b.textStrategy,
    version: b.version,
  }));
}

export async function listPublicRecommendedGames(db: AppDb): Promise<
  Array<{
    id: string;
    gameId: string;
    sortOrder: number;
    tag: string | null;
    coverUrl: string | null;
    locales: RecommendedGameRow["locales"];
  }>
> {
  await ensureAdminSchema(db);
  const items = await listPlayerRecommendedGames(db as unknown as AdminDb);
  return items.map((g) => ({
    id: g.id,
    gameId: g.gameId,
    sortOrder: g.sortOrder,
    tag: g.tag,
    coverUrl: g.coverUrl,
    locales: g.locales,
  }));
}

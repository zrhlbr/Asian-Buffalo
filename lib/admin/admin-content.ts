/**
 * ADMIN-1F Content Center — Banners + Recommended Games.
 * Extends admin bootstrap sidecars; does not fork announcements/VIP/activity tables.
 *
 * Image policy: HTTPS URL only (no HTML/JS/SVG upload). File upload = NOT AVAILABLE.
 * Scheduling: start/end stored; ACTIVE computed at read — no fake cron auto-publish.
 */

import { sql } from "drizzle-orm";
import type { AdminDb } from "./admin-queries.ts";
import {
  assertLocalesComplete,
  emptyLocales,
  localeCompleteness,
  normalizeLocaleBundle,
  type LocaleBundle,
} from "./admin-content-i18n.ts";

export const OFFICIAL_GAME_IDS = ["bull-demon-king"] as const;

export type BannerStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "EXPIRED";

export type BannerRow = {
  id: string;
  title: string;
  locales: LocaleBundle;
  imageUrl: string;
  targetUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: BannerStatus;
  sortOrder: number;
  textStrategy: "TRI_LOCALE" | "IMAGE_ONLY";
  version: number;
  createdBy: string;
  updatedBy: string | null;
  publishedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  localeCompleteness: ReturnType<typeof localeCompleteness>;
  scheduling: "PARTIAL";
};

export type RecommendedGameRow = {
  id: string;
  gameId: string;
  sortOrder: number;
  enabled: boolean;
  tag: string | null;
  coverUrl: string | null;
  locales: LocaleBundle;
  createdBy: string;
  updatedBy: string | null;
  updatedAt: string;
  createdAt: string;
};

function nowSql(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string") return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Reject javascript:/data:/html uploads; allow https (and relative / for local). */
export function validateContentUrl(
  url: string,
  opts?: { allowEmpty?: boolean; field?: string },
): { ok: true; url: string } | { ok: false; code: string; message: string } {
  const field = opts?.field ?? "url";
  const trimmed = url.trim();
  if (!trimmed) {
    if (opts?.allowEmpty) return { ok: true, url: "" };
    return { ok: false, code: "INVALID_REQUEST", message: `${field} required` };
  }
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.includes("<script") ||
    /\.(html?|js|svg)(\?|#|$)/i.test(trimmed)
  ) {
    return { ok: false, code: "MEDIA_REJECTED", message: `${field} type not allowed` };
  }
  if (trimmed.startsWith("/")) return { ok: true, url: trimmed };
  if (lower.startsWith("https://")) return { ok: true, url: trimmed };
  if (lower.startsWith("http://") && /localhost|127\.0\.0\.1/.test(trimmed)) {
    return { ok: true, url: trimmed };
  }
  return { ok: false, code: "MEDIA_REJECTED", message: `${field} must be https URL or site path` };
}

function computeBannerStatus(
  stored: string,
  startsAt: string | null,
  endsAt: string | null,
): BannerStatus {
  if (stored === "DRAFT" || stored === "PAUSED") return stored as BannerStatus;
  if (stored !== "ACTIVE" && stored !== "SCHEDULED" && stored !== "EXPIRED") {
    return "DRAFT";
  }
  const now = Date.now();
  const startMs = startsAt ? Date.parse(startsAt) : null;
  const endMs = endsAt ? Date.parse(endsAt) : null;
  if (endMs != null && Number.isFinite(endMs) && endMs <= now) return "EXPIRED";
  if (startMs != null && Number.isFinite(startMs) && startMs > now) return "SCHEDULED";
  if (stored === "ACTIVE" || stored === "SCHEDULED") return "ACTIVE";
  return stored as BannerStatus;
}

function mapBanner(row: Record<string, unknown>): BannerRow {
  const locales = normalizeLocaleBundle(parseJsonObject(row.locales_json));
  const startsAt = row.starts_at ? String(row.starts_at) : null;
  const endsAt = row.ends_at ? String(row.ends_at) : null;
  const stored = String(row.status ?? "DRAFT");
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    locales,
    imageUrl: String(row.image_url ?? ""),
    targetUrl: row.target_url ? String(row.target_url) : null,
    startsAt,
    endsAt,
    status: computeBannerStatus(stored, startsAt, endsAt),
    sortOrder: Number(row.sort_order ?? 0),
    textStrategy: String(row.text_strategy ?? "TRI_LOCALE") === "IMAGE_ONLY" ? "IMAGE_ONLY" : "TRI_LOCALE",
    version: Number(row.version ?? 1),
    createdBy: String(row.created_by ?? ""),
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    publishedBy: row.published_by ? String(row.published_by) : null,
    publishedAt: row.published_at ? String(row.published_at) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    localeCompleteness: localeCompleteness(locales),
    scheduling: "PARTIAL",
  };
}

export async function listBanners(
  db: AdminDb,
  opts?: { page?: number; pageSize?: number; status?: string },
): Promise<{ items: BannerRow[]; page: number; pageSize: number; total: number }> {
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  const all = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM admin_banners ORDER BY sort_order ASC, created_at DESC
  `);
  let items = all.map(mapBanner);
  if (opts?.status) {
    const s = opts.status.toUpperCase();
    items = items.filter((b) => b.status === s);
  }
  const total = items.length;
  return { items: items.slice(offset, offset + pageSize), page, pageSize, total };
}

export async function getBanner(db: AdminDb, id: string): Promise<BannerRow | null> {
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM admin_banners WHERE id = ${id} LIMIT 1
  `);
  return rows[0] ? mapBanner(rows[0]) : null;
}

export type BannerUpsertInput = {
  id?: string;
  title: string;
  locales?: unknown;
  imageUrl: string;
  targetUrl?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  sortOrder?: number;
  textStrategy?: "TRI_LOCALE" | "IMAGE_ONLY";
  status?: "DRAFT" | "PAUSED";
  adminUsername: string;
};

export async function upsertBanner(
  db: AdminDb,
  input: BannerUpsertInput,
): Promise<{ ok: true; banner: BannerRow } | { ok: false; code: string; message: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, code: "INVALID_REQUEST", message: "title required" };
  const img = validateContentUrl(input.imageUrl, { field: "imageUrl" });
  if (!img.ok) return img;
  let target: string | null = null;
  if (input.targetUrl) {
    const t = validateContentUrl(input.targetUrl, { field: "targetUrl", allowEmpty: true });
    if (!t.ok) return t;
    target = t.url || null;
  }
  const locales = normalizeLocaleBundle(input.locales ?? emptyLocales());
  const textStrategy = input.textStrategy === "IMAGE_ONLY" ? "IMAGE_ONLY" : "TRI_LOCALE";
  if (textStrategy === "TRI_LOCALE") {
    // Draft may be incomplete; completeness enforced on publish.
  }
  const status = input.status === "PAUSED" ? "PAUSED" : "DRAFT";
  const ts = nowSql();
  if (input.id) {
    const existing = await getBanner(db, input.id);
    if (!existing) return { ok: false, code: "NOT_FOUND", message: "banner not found" };
    if (existing.status === "ACTIVE" || existing.status === "SCHEDULED") {
      return { ok: false, code: "INVALID_STATE", message: "Unpublish before editing published banner" };
    }
    await db.run(sql`
      UPDATE admin_banners SET
        title = ${title},
        locales_json = ${JSON.stringify(locales)},
        image_url = ${img.url},
        target_url = ${target},
        starts_at = ${input.startsAt ?? null},
        ends_at = ${input.endsAt ?? null},
        sort_order = ${Number(input.sortOrder ?? existing.sortOrder)},
        text_strategy = ${textStrategy},
        status = ${status},
        updated_by = ${input.adminUsername},
        updated_at = ${ts},
        version = ${existing.version + 1}
      WHERE id = ${input.id}
    `);
    const banner = await getBanner(db, input.id);
    return { ok: true, banner: banner! };
  }
  const id = crypto.randomUUID();
  await db.run(sql`
    INSERT INTO admin_banners (
      id, title, locales_json, image_url, target_url, starts_at, ends_at,
      status, sort_order, text_strategy, version, created_by, updated_by, created_at, updated_at
    ) VALUES (
      ${id}, ${title}, ${JSON.stringify(locales)}, ${img.url}, ${target},
      ${input.startsAt ?? null}, ${input.endsAt ?? null},
      ${status}, ${Number(input.sortOrder ?? 0)}, ${textStrategy}, 1,
      ${input.adminUsername}, ${input.adminUsername}, ${ts}, ${ts}
    )
  `);
  const banner = await getBanner(db, id);
  return { ok: true, banner: banner! };
}

export async function publishBanner(
  db: AdminDb,
  id: string,
  adminUsername: string,
): Promise<{ ok: true; banner: BannerRow } | { ok: false; code: string; message: string }> {
  const existing = await getBanner(db, id);
  if (!existing) return { ok: false, code: "NOT_FOUND", message: "banner not found" };
  if (existing.textStrategy === "TRI_LOCALE") {
    const check = assertLocalesComplete(existing.locales);
    if (!check.ok) return { ok: false, code: check.code, message: check.message };
  }
  if (!existing.imageUrl) {
    return { ok: false, code: "INVALID_REQUEST", message: "imageUrl required" };
  }
  const ts = nowSql();
  const nextStatus =
    existing.startsAt && Date.parse(existing.startsAt) > Date.now() ? "SCHEDULED" : "ACTIVE";
  await db.run(sql`
    UPDATE admin_banners SET
      status = ${nextStatus},
      published_by = ${adminUsername},
      published_at = ${ts},
      updated_by = ${adminUsername},
      updated_at = ${ts},
      version = ${existing.version + 1}
    WHERE id = ${id}
  `);
  const banner = await getBanner(db, id);
  return { ok: true, banner: banner! };
}

export async function unpublishBanner(
  db: AdminDb,
  id: string,
  adminUsername: string,
): Promise<{ ok: true; banner: BannerRow } | { ok: false; code: string; message: string }> {
  const existing = await getBanner(db, id);
  if (!existing) return { ok: false, code: "NOT_FOUND", message: "banner not found" };
  const ts = nowSql();
  await db.run(sql`
    UPDATE admin_banners SET
      status = 'PAUSED',
      updated_by = ${adminUsername},
      updated_at = ${ts},
      version = ${existing.version + 1}
    WHERE id = ${id}
  `);
  const banner = await getBanner(db, id);
  return { ok: true, banner: banner! };
}

export async function listPlayerBanners(db: AdminDb): Promise<BannerRow[]> {
  const { items } = await listBanners(db, { page: 1, pageSize: 100 });
  return items.filter((b) => b.status === "ACTIVE" || b.status === "SCHEDULED").filter((b) => {
    // SCHEDULED with future start should not show; computeBannerStatus already maps.
    return b.status === "ACTIVE";
  });
}

function mapRecommended(row: Record<string, unknown>): RecommendedGameRow {
  return {
    id: String(row.id),
    gameId: String(row.game_id),
    sortOrder: Number(row.sort_order ?? 0),
    enabled: Number(row.enabled) === 1,
    tag: row.tag ? String(row.tag) : null,
    coverUrl: row.cover_url ? String(row.cover_url) : null,
    locales: normalizeLocaleBundle(parseJsonObject(row.locales_json)),
    createdBy: String(row.created_by ?? ""),
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    updatedAt: String(row.updated_at ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

export async function listRecommendedGames(db: AdminDb): Promise<RecommendedGameRow[]> {
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM admin_recommended_games ORDER BY sort_order ASC, created_at ASC
  `);
  return rows.map(mapRecommended);
}

export async function upsertRecommendedGame(
  db: AdminDb,
  input: {
    id?: string;
    gameId: string;
    sortOrder?: number;
    enabled?: boolean;
    tag?: string | null;
    coverUrl?: string | null;
    locales?: unknown;
    adminUsername: string;
  },
): Promise<{ ok: true; item: RecommendedGameRow } | { ok: false; code: string; message: string }> {
  const gameId = input.gameId.trim();
  if (!(OFFICIAL_GAME_IDS as readonly string[]).includes(gameId)) {
    return {
      ok: false,
      code: "INVALID_GAME",
      message: `gameId must be an existing official game; allowed: ${OFFICIAL_GAME_IDS.join(",")}`,
    };
  }
  let cover: string | null = null;
  if (input.coverUrl) {
    const c = validateContentUrl(input.coverUrl, { field: "coverUrl", allowEmpty: true });
    if (!c.ok) return c;
    cover = c.url || null;
  }
  const locales = normalizeLocaleBundle(input.locales ?? emptyLocales());
  const ts = nowSql();
  if (input.id) {
    await db.run(sql`
      UPDATE admin_recommended_games SET
        game_id = ${gameId},
        sort_order = ${Number(input.sortOrder ?? 0)},
        enabled = ${input.enabled === false ? 0 : 1},
        tag = ${input.tag ?? null},
        cover_url = ${cover},
        locales_json = ${JSON.stringify(locales)},
        updated_by = ${input.adminUsername},
        updated_at = ${ts}
      WHERE id = ${input.id}
    `);
    const rows = await db.all<Record<string, unknown>>(sql`
      SELECT * FROM admin_recommended_games WHERE id = ${input.id} LIMIT 1
    `);
    if (!rows[0]) return { ok: false, code: "NOT_FOUND", message: "recommended game not found" };
    return { ok: true, item: mapRecommended(rows[0]) };
  }
  const id = crypto.randomUUID();
  await db.run(sql`
    INSERT INTO admin_recommended_games (
      id, game_id, sort_order, enabled, tag, cover_url, locales_json,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      ${id}, ${gameId}, ${Number(input.sortOrder ?? 0)}, ${input.enabled === false ? 0 : 1},
      ${input.tag ?? null}, ${cover}, ${JSON.stringify(locales)},
      ${input.adminUsername}, ${input.adminUsername}, ${ts}, ${ts}
    )
  `);
  const rows = await db.all<Record<string, unknown>>(sql`
    SELECT * FROM admin_recommended_games WHERE id = ${id} LIMIT 1
  `);
  return { ok: true, item: mapRecommended(rows[0]!) };
}

export async function listPlayerRecommendedGames(db: AdminDb): Promise<RecommendedGameRow[]> {
  const items = await listRecommendedGames(db);
  return items.filter((i) => i.enabled);
}

export function contentCenterMeta() {
  return {
    mediaUpload: "NOT_AVAILABLE",
    mediaPolicy: "HTTPS_URL_ONLY",
    scheduling: "PARTIAL",
    rewardPayout: "BLOCKED",
    brandLogoEditable: false,
    officialGames: [...OFFICIAL_GAME_IDS],
  };
}

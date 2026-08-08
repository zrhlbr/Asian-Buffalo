/**
 * Player-facing announcements reader (admin_announcements → game client).
 * PUBLISHED only; respects optional publishAt / expiresAt in content JSON.
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";
import { ensureAdminSchema } from "./admin/admin-bootstrap.ts";

type AppDb = DrizzleD1Database<typeof schema>;

export type PlayerAnnouncement = {
  id: string;
  title: string;
  level: string;
  locales: { zh: string; en: string; my: string };
  publishAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

function parseContent(raw: string): {
  locales: { zh: string; en: string; my: string };
  publishAt: string | null;
  expiresAt: string | null;
} {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && ("zh" in parsed || "en" in parsed || "my" in parsed)) {
      return {
        locales: {
          zh: typeof parsed.zh === "string" ? parsed.zh : "",
          en: typeof parsed.en === "string" ? parsed.en : "",
          my: typeof parsed.my === "string" ? parsed.my : "",
        },
        publishAt: typeof parsed.publishAt === "string" ? parsed.publishAt : null,
        expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : null,
      };
    }
  } catch {
    /* plain text content */
  }
  return {
    locales: { zh: raw, en: raw, my: raw },
    publishAt: null,
    expiresAt: null,
  };
}

function isLive(now: number, publishAt: string | null, expiresAt: string | null): boolean {
  if (publishAt) {
    const t = Date.parse(publishAt);
    if (Number.isFinite(t) && t > now) return false;
  }
  if (expiresAt) {
    const t = Date.parse(expiresAt);
    if (Number.isFinite(t) && t <= now) return false;
  }
  return true;
}

export async function listPlayerAnnouncements(db: AppDb): Promise<PlayerAnnouncement[]> {
  await ensureAdminSchema(db);
  const rows = await db.all<{
    id: string;
    title: string;
    content: string;
    level: string;
    created_at: string;
  }>(sql`
    SELECT id, title, content, level, created_at
    FROM admin_announcements
    WHERE status = 'PUBLISHED'
    ORDER BY created_at DESC
    LIMIT 50
  `);
  const now = Date.now();
  const out: PlayerAnnouncement[] = [];
  for (const row of rows) {
    const parsed = parseContent(String(row.content ?? ""));
    if (!isLive(now, parsed.publishAt, parsed.expiresAt)) continue;
    out.push({
      id: String(row.id),
      title: String(row.title),
      level: String(row.level),
      locales: parsed.locales,
      publishAt: parsed.publishAt,
      expiresAt: parsed.expiresAt,
      createdAt: String(row.created_at),
    });
  }
  return out;
}

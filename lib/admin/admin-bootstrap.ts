/**
 * R1-M7 Admin console — sidecar schema bootstrap.
 *
 * Creates the admin-namespaced tables (admin_users / admin_sessions /
 * admin_audit_logs / admin_announcements / admin_system_config) with
 * CREATE TABLE IF NOT EXISTS. This mirrors the dev-schema-bootstrap pattern:
 * it never touches production migration files and never alters game tables.
 *
 * Super-admin seeding policy (fail-closed):
 *  - AB_ADMIN_BOOTSTRAP_PASSWORD set   → seed `admin` with that password.
 *  - Dev/test gate (AB_ALLOW_TEST_IDENTITY=1) → seed `admin` / `admin123`.
 *  - Otherwise no admin is seeded and login stays impossible.
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../../db/schema.ts";
import { generateSalt, hashAdminPassword } from "./admin-auth.ts";
import { isDevTestIdentityEnabled } from "../runtime-identity.ts";
import {
  ensurePlayerCommerceReady,
  resetPlayerCommerceBootstrapForTests,
} from "../player-commerce-bootstrap.ts";

export const ADMIN_BOOTSTRAP_USERNAME = "admin";
export const ADMIN_DEV_PASSWORD = "admin123";

export const ADMIN_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" text PRIMARY KEY NOT NULL,
  "username" text NOT NULL,
  "password_hash" text NOT NULL,
  "salt" text NOT NULL,
  "role" text NOT NULL,
  "status" text DEFAULT 'ACTIVE' NOT NULL,
  "display_name" text,
  "last_login_at" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_username_unique" ON "admin_users" ("username");
CREATE TABLE IF NOT EXISTS "admin_sessions" (
  "token" text PRIMARY KEY NOT NULL,
  "admin_id" text NOT NULL,
  "ip" text,
  "user_agent" text,
  "expires_at" text NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "admin_sessions_admin_idx" ON "admin_sessions" ("admin_id");
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "admin_id" text NOT NULL,
  "admin_username" text NOT NULL,
  "admin_role" text,
  "action" text NOT NULL,
  "target_type" text,
  "target_id" text,
  "reason" text,
  "ip" text,
  "request_id" text,
  "before_json" text,
  "after_json" text,
  "detail_json" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "admin_audit_logs_created_idx" ON "admin_audit_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_admin_idx" ON "admin_audit_logs" ("admin_id");
CREATE TABLE IF NOT EXISTS "admin_announcements" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "level" text DEFAULT 'INFO' NOT NULL,
  "status" text DEFAULT 'UNPUBLISHED' NOT NULL,
  "created_by" text NOT NULL,
  "announcement_type" text DEFAULT 'NOTICE',
  "published_by" text,
  "published_at" text,
  "version" integer DEFAULT 1,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS "admin_system_config" (
  "key" text PRIMARY KEY NOT NULL,
  "value_json" text NOT NULL,
  "updated_by" text,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS "admin_risk_events" (
  "id" text PRIMARY KEY NOT NULL,
  "fingerprint" text NOT NULL,
  "player_id" text,
  "type" text NOT NULL,
  "category" text NOT NULL,
  "level" text NOT NULL,
  "status" text NOT NULL DEFAULT 'OPEN',
  "evidence_summary" text NOT NULL,
  "subject_type" text,
  "subject_id" text,
  "related_reference" text,
  "source" text NOT NULL DEFAULT 'signal',
  "detected_at" text,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "resolved_at" text,
  "resolved_by" text,
  "resolve_reason" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "admin_risk_events_fingerprint_unique"
  ON "admin_risk_events" ("fingerprint");
CREATE INDEX IF NOT EXISTS "admin_risk_events_status_idx"
  ON "admin_risk_events" ("status", "level", "detected_at");
CREATE INDEX IF NOT EXISTS "admin_risk_events_player_idx"
  ON "admin_risk_events" ("player_id", "created_at");
CREATE TABLE IF NOT EXISTS "admin_risk_notes" (
  "id" text PRIMARY KEY NOT NULL,
  "risk_id" text NOT NULL,
  "admin_id" text NOT NULL,
  "admin_username" text NOT NULL,
  "note" text NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "admin_risk_notes_risk_idx"
  ON "admin_risk_notes" ("risk_id", "created_at");
CREATE TABLE IF NOT EXISTS "admin_banners" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "locales_json" text NOT NULL DEFAULT '{}',
  "image_url" text NOT NULL,
  "target_url" text,
  "starts_at" text,
  "ends_at" text,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "sort_order" integer NOT NULL DEFAULT 0,
  "text_strategy" text NOT NULL DEFAULT 'TRI_LOCALE',
  "version" integer NOT NULL DEFAULT 1,
  "created_by" text NOT NULL,
  "updated_by" text,
  "published_by" text,
  "published_at" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "admin_banners_status_idx" ON "admin_banners" ("status", "sort_order");
CREATE TABLE IF NOT EXISTS "admin_recommended_games" (
  "id" text PRIMARY KEY NOT NULL,
  "game_id" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "enabled" integer NOT NULL DEFAULT 1,
  "tag" text,
  "cover_url" text,
  "locales_json" text NOT NULL DEFAULT '{}',
  "created_by" text NOT NULL,
  "updated_by" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "admin_recommended_games_sort_idx"
  ON "admin_recommended_games" ("enabled", "sort_order");
CREATE TABLE IF NOT EXISTS "admin_tickets" (
  "id" text PRIMARY KEY NOT NULL,
  "player_id" text,
  "category" text NOT NULL,
  "subject" text NOT NULL,
  "status" text NOT NULL DEFAULT 'OPEN',
  "priority" text NOT NULL DEFAULT 'NORMAL',
  "assigned_admin_id" text,
  "assigned_admin_username" text,
  "related_json" text NOT NULL DEFAULT '{}',
  "created_by" text NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "last_reply_at" text,
  "resolved_at" text,
  "closed_at" text
);
CREATE INDEX IF NOT EXISTS "admin_tickets_status_idx"
  ON "admin_tickets" ("status", "priority", "updated_at");
CREATE INDEX IF NOT EXISTS "admin_tickets_player_idx"
  ON "admin_tickets" ("player_id", "created_at");
CREATE TABLE IF NOT EXISTS "admin_ticket_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "ticket_id" text NOT NULL,
  "author_type" text NOT NULL DEFAULT 'ADMIN',
  "author_id" text,
  "author_username" text NOT NULL,
  "body" text NOT NULL,
  "is_internal" integer NOT NULL DEFAULT 0,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "admin_ticket_messages_ticket_idx"
  ON "admin_ticket_messages" ("ticket_id", "created_at");
`;

const ADMIN_SYSTEM_CONFIG_DEFAULTS: Record<string, unknown> = {
  maintenance_mode: { enabled: false },
  support_info: { telegram: "", email: "", hours: "24/7" },
  languages: { available: ["zh", "en", "my"], default: "zh" },
};

let applied = false;

export function resetAdminBootstrapCacheForTests(): void {
  applied = false;
  resetPlayerCommerceBootstrapForTests();
}

export async function ensureAdminSchema(
  db: DrizzleD1Database<typeof schema>,
): Promise<void> {
  if (!applied) {
    const statements = ADMIN_SCHEMA_SQL.split(";")
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);
    for (const statement of statements) {
      await db.run(sql.raw(statement));
    }
  }
  // Additive columns / ADMIN-1E risk sidecars (safe on existing installs).
  for (const alter of [
    `ALTER TABLE "admin_audit_logs" ADD COLUMN "admin_role" text`,
    `ALTER TABLE "admin_audit_logs" ADD COLUMN "request_id" text`,
    `ALTER TABLE "admin_audit_logs" ADD COLUMN "before_json" text`,
    `ALTER TABLE "admin_audit_logs" ADD COLUMN "after_json" text`,
    `CREATE TABLE IF NOT EXISTS "admin_risk_events" (
      "id" text PRIMARY KEY NOT NULL,
      "fingerprint" text NOT NULL,
      "player_id" text,
      "type" text NOT NULL,
      "category" text NOT NULL,
      "level" text NOT NULL,
      "status" text NOT NULL DEFAULT 'OPEN',
      "evidence_summary" text NOT NULL,
      "subject_type" text,
      "subject_id" text,
      "related_reference" text,
      "source" text NOT NULL DEFAULT 'signal',
      "detected_at" text,
      "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "resolved_at" text,
      "resolved_by" text,
      "resolve_reason" text,
      "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "admin_risk_events_fingerprint_unique" ON "admin_risk_events" ("fingerprint")`,
    `CREATE INDEX IF NOT EXISTS "admin_risk_events_status_idx" ON "admin_risk_events" ("status", "level", "detected_at")`,
    `CREATE INDEX IF NOT EXISTS "admin_risk_events_player_idx" ON "admin_risk_events" ("player_id", "created_at")`,
    `CREATE TABLE IF NOT EXISTS "admin_risk_notes" (
      "id" text PRIMARY KEY NOT NULL,
      "risk_id" text NOT NULL,
      "admin_id" text NOT NULL,
      "admin_username" text NOT NULL,
      "note" text NOT NULL,
      "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "admin_risk_notes_risk_idx" ON "admin_risk_notes" ("risk_id", "created_at")`,
    `CREATE TABLE IF NOT EXISTS "admin_banners" (
      "id" text PRIMARY KEY NOT NULL,
      "title" text NOT NULL,
      "locales_json" text NOT NULL DEFAULT '{}',
      "image_url" text NOT NULL,
      "target_url" text,
      "starts_at" text,
      "ends_at" text,
      "status" text NOT NULL DEFAULT 'DRAFT',
      "sort_order" integer NOT NULL DEFAULT 0,
      "text_strategy" text NOT NULL DEFAULT 'TRI_LOCALE',
      "version" integer NOT NULL DEFAULT 1,
      "created_by" text NOT NULL,
      "updated_by" text,
      "published_by" text,
      "published_at" text,
      "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "admin_banners_status_idx" ON "admin_banners" ("status", "sort_order")`,
    `CREATE TABLE IF NOT EXISTS "admin_recommended_games" (
      "id" text PRIMARY KEY NOT NULL,
      "game_id" text NOT NULL,
      "sort_order" integer NOT NULL DEFAULT 0,
      "enabled" integer NOT NULL DEFAULT 1,
      "tag" text,
      "cover_url" text,
      "locales_json" text NOT NULL DEFAULT '{}',
      "created_by" text NOT NULL,
      "updated_by" text,
      "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "admin_recommended_games_sort_idx" ON "admin_recommended_games" ("enabled", "sort_order")`,
    `ALTER TABLE "admin_announcements" ADD COLUMN "announcement_type" text DEFAULT 'NOTICE'`,
    `ALTER TABLE "admin_announcements" ADD COLUMN "published_by" text`,
    `ALTER TABLE "admin_announcements" ADD COLUMN "published_at" text`,
    `ALTER TABLE "admin_announcements" ADD COLUMN "version" integer DEFAULT 1`,
    `CREATE TABLE IF NOT EXISTS "admin_tickets" (
      "id" text PRIMARY KEY NOT NULL,
      "player_id" text,
      "category" text NOT NULL,
      "subject" text NOT NULL,
      "status" text NOT NULL DEFAULT 'OPEN',
      "priority" text NOT NULL DEFAULT 'NORMAL',
      "assigned_admin_id" text,
      "assigned_admin_username" text,
      "related_json" text NOT NULL DEFAULT '{}',
      "created_by" text NOT NULL,
      "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "last_reply_at" text,
      "resolved_at" text,
      "closed_at" text
    )`,
    `CREATE INDEX IF NOT EXISTS "admin_tickets_status_idx" ON "admin_tickets" ("status", "priority", "updated_at")`,
    `CREATE INDEX IF NOT EXISTS "admin_tickets_player_idx" ON "admin_tickets" ("player_id", "created_at")`,
    `CREATE TABLE IF NOT EXISTS "admin_ticket_messages" (
      "id" text PRIMARY KEY NOT NULL,
      "ticket_id" text NOT NULL,
      "author_type" text NOT NULL DEFAULT 'ADMIN',
      "author_id" text,
      "author_username" text NOT NULL,
      "body" text NOT NULL,
      "is_internal" integer NOT NULL DEFAULT 0,
      "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "admin_ticket_messages_ticket_idx" ON "admin_ticket_messages" ("ticket_id", "created_at")`,
    `ALTER TABLE "admin_users" ADD COLUMN "display_name" text`,
  ]) {
    try {
      await db.run(sql.raw(alter));
    } catch {
      /* already present */
    }
  }
  if (!applied) {
    await seedAdminSystemConfigDefaults(db);
  }
  applied = true;
}

async function seedAdminSystemConfigDefaults(
  db: DrizzleD1Database<typeof schema>,
): Promise<void> {
  for (const [key, value] of Object.entries(ADMIN_SYSTEM_CONFIG_DEFAULTS)) {
    await db.run(sql`
      INSERT INTO admin_system_config ("key", "value_json", "updated_by")
      VALUES (${key}, ${JSON.stringify(value)}, 'system')
      ON CONFLICT("key") DO NOTHING
    `);
  }
}

function readEnv(name: string): string | undefined {
  try {
    const value = process.env[name];
    if (typeof value === "string" && value.length > 0) return value;
  } catch {
    /* non-Node runtime */
  }
  return undefined;
}

/**
 * Seed the initial super admin when the admin_users table is empty.
 * Fail-closed: without a bootstrap password or the dev/test gate this is a
 * no-op and admin login remains impossible.
 */
export async function seedInitialSuperAdmin(
  db: DrizzleD1Database<typeof schema>,
): Promise<{ seeded: boolean; username?: string }> {
  const existing = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM admin_users`);
  if ((existing[0]?.n ?? 0) > 0) return { seeded: false };

  const bootstrapPassword = readEnv("AB_ADMIN_BOOTSTRAP_PASSWORD");
  const password = bootstrapPassword ?? (isDevTestIdentityEnabled() ? ADMIN_DEV_PASSWORD : null);
  if (!password) return { seeded: false };

  const salt = generateSalt();
  const passwordHash = await hashAdminPassword(password, salt);
  await db.run(sql`
    INSERT INTO admin_users ("id", "username", "password_hash", "salt", "role", "status")
    VALUES (${crypto.randomUUID()}, ${ADMIN_BOOTSTRAP_USERNAME}, ${passwordHash}, ${salt}, 'SUPER_ADMIN', 'ACTIVE')
  `);
  return { seeded: true, username: ADMIN_BOOTSTRAP_USERNAME };
}

/** Full lazy bootstrap used by every admin API entrypoint. */
export async function ensureAdminBootstrap(
  db: DrizzleD1Database<typeof schema>,
): Promise<void> {
  await ensureAdminSchema(db);
  // Profile/VIP sidecars — additive IF NOT EXISTS (screenshot-features Phase 2+)
  await ensurePlayerCommerceReady(db);
  await seedInitialSuperAdmin(db);
}

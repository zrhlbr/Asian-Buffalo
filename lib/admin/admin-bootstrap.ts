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
  "action" text NOT NULL,
  "target_type" text,
  "target_id" text,
  "reason" text,
  "ip" text,
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
  "status" text DEFAULT 'PUBLISHED' NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS "admin_system_config" (
  "key" text PRIMARY KEY NOT NULL,
  "value_json" text NOT NULL,
  "updated_by" text,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
`;

const ADMIN_SYSTEM_CONFIG_DEFAULTS: Record<string, unknown> = {
  maintenance_mode: { enabled: false },
  support_info: { telegram: "", email: "", hours: "24/7" },
  languages: { available: ["zh", "en", "my"], default: "zh" },
};

let applied = false;

export function resetAdminBootstrapCacheForTests(): void {
  applied = false;
}

export async function ensureAdminSchema(
  db: DrizzleD1Database<typeof schema>,
): Promise<void> {
  if (applied) return;
  const statements = ADMIN_SCHEMA_SQL.split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
  for (const statement of statements) {
    await db.run(sql.raw(statement));
  }
  await seedAdminSystemConfigDefaults(db);
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
  await seedInitialSuperAdmin(db);
}

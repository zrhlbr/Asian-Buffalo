/**
 * Additive player Auth sidecar schema (credentials / OTP / sessions / audit / prefs).
 * CREATE TABLE IF NOT EXISTS only — never alters core players/wallet/ledger tables.
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";
import { ensurePlayerCommerceReady } from "./player-commerce-bootstrap.ts";

export const PLAYER_AUTH_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "player_auth_accounts" (
  "player_id" text PRIMARY KEY NOT NULL,
  "phone_e164" text,
  "email" text,
  "password_hash" text NOT NULL,
  "password_salt" text NOT NULL,
  "password_algo" text NOT NULL DEFAULT 'pbkdf2-sha256',
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "failed_login_count" integer NOT NULL DEFAULT 0,
  "locked_until" text,
  "password_changed_at" text,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "player_auth_accounts_phone_unique"
  ON "player_auth_accounts" ("phone_e164");
CREATE UNIQUE INDEX IF NOT EXISTS "player_auth_accounts_email_unique"
  ON "player_auth_accounts" ("email");

CREATE TABLE IF NOT EXISTS "player_auth_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "player_id" text NOT NULL,
  "access_token_hash" text NOT NULL,
  "refresh_token_hash" text NOT NULL,
  "ip" text,
  "device" text,
  "user_agent" text,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" text NOT NULL,
  "refresh_expires_at" text NOT NULL,
  "revoked_at" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "player_auth_sessions_access_unique"
  ON "player_auth_sessions" ("access_token_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "player_auth_sessions_refresh_unique"
  ON "player_auth_sessions" ("refresh_token_hash");
CREATE INDEX IF NOT EXISTS "player_auth_sessions_player_idx"
  ON "player_auth_sessions" ("player_id", "revoked_at");

CREATE TABLE IF NOT EXISTS "player_otp_challenges" (
  "id" text PRIMARY KEY NOT NULL,
  "channel" text NOT NULL,
  "destination" text NOT NULL,
  "purpose" text NOT NULL,
  "code_hash" text NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 5,
  "verified_at" text,
  "consumed_at" text,
  "expires_at" text NOT NULL,
  "ip" text,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "player_otp_challenges_dest_idx"
  ON "player_otp_challenges" ("destination", "purpose", "created_at");

CREATE TABLE IF NOT EXISTS "player_auth_audit" (
  "id" text PRIMARY KEY NOT NULL,
  "player_id" text,
  "event" text NOT NULL,
  "channel" text,
  "destination_masked" text,
  "ip" text,
  "device" text,
  "success" integer NOT NULL DEFAULT 0,
  "detail_json" text,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "player_auth_audit_player_idx"
  ON "player_auth_audit" ("player_id", "created_at");
CREATE INDEX IF NOT EXISTS "player_auth_audit_event_idx"
  ON "player_auth_audit" ("event", "created_at");

CREATE TABLE IF NOT EXISTS "player_preferences" (
  "player_id" text PRIMARY KEY NOT NULL,
  "lang" text NOT NULL DEFAULT 'zh-CN',
  "marketing_opt_in" integer NOT NULL DEFAULT 0,
  "updated_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "player_auth_rate_limits" (
  "bucket_key" text PRIMARY KEY NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  "window_started_at" text NOT NULL,
  "updated_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

const appliedDbs = new WeakSet<object>();

export function resetPlayerAuthBootstrapForTests(): void {
  /* WeakSet cannot clear; new db objects in tests get fresh ensure. */
}

export async function ensurePlayerAuthSchema(
  db: DrizzleD1Database<typeof schema>,
): Promise<void> {
  const key = db as unknown as object;
  if (appliedDbs.has(key)) return;
  const statements = PLAYER_AUTH_SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    await db.run(sql.raw(statement));
  }
  appliedDbs.add(key);
}

export async function ensurePlayerAuthReady(
  db: DrizzleD1Database<typeof schema>,
): Promise<void> {
  await ensurePlayerCommerceReady(db);
  await ensurePlayerAuthSchema(db);
}

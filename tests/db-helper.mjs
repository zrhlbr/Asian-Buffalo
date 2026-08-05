import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.ts";

export function createTestDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });

  // Run the existing Drizzle migration SQL directly.
  const migrationSql =
    `CREATE TABLE IF NOT EXISTS "players" (
       "id" text PRIMARY KEY NOT NULL,
       "wallet_adapter_ref" text NOT NULL,
       "currency" text DEFAULT 'MMK' NOT NULL,
       "status" text DEFAULT 'ACTIVE' NOT NULL,
       "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
       "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
     );
     CREATE UNIQUE INDEX IF NOT EXISTS "players_wallet_adapter_ref_unique" ON "players" ("wallet_adapter_ref");
     CREATE TABLE IF NOT EXISTS "game_math_versions" (
       "id" text PRIMARY KEY NOT NULL,
       "sha256" text NOT NULL,
       "status" text DEFAULT 'DRAFT' NOT NULL,
       "config_json" text NOT NULL,
       "activated_at" text,
       "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
     );
     CREATE UNIQUE INDEX IF NOT EXISTS "game_math_versions_sha256_unique" ON "game_math_versions" ("sha256");
     CREATE TABLE IF NOT EXISTS "game_sessions" (
       "id" text PRIMARY KEY NOT NULL,
       "player_id" text NOT NULL,
       "math_version_id" text NOT NULL,
       "status" text DEFAULT 'OPEN' NOT NULL,
       "free_games_remaining" integer DEFAULT 0 NOT NULL,
       "expires_at" text NOT NULL,
       "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
       "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
     );
     CREATE INDEX IF NOT EXISTS "game_sessions_player_status_idx" ON "game_sessions" ("player_id", "status");
     CREATE TABLE IF NOT EXISTS "game_rounds" (
       "id" text PRIMARY KEY NOT NULL,
       "session_id" text NOT NULL,
       "player_id" text NOT NULL,
       "math_version_id" text NOT NULL,
       "idempotency_key" text NOT NULL,
       "request_hash" text NOT NULL,
       "request_payload" text,
       "result_hash" text,
       "status" text DEFAULT 'PENDING' NOT NULL,
       "currency" text NOT NULL,
       "total_bet_minor" integer NOT NULL,
       "total_win_minor" integer,
       "balance_after_minor" integer,
       "is_free_game" integer DEFAULT false NOT NULL,
       "outcome_json" text,
       "settled_at" text,
       "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
     );
     CREATE UNIQUE INDEX IF NOT EXISTS "game_rounds_player_idempotency_unique" ON "game_rounds" ("player_id", "idempotency_key");
     CREATE INDEX IF NOT EXISTS "game_rounds_session_created_idx" ON "game_rounds" ("session_id", "created_at");
     CREATE TABLE IF NOT EXISTS "ledger_accounts" (
       "id" text PRIMARY KEY NOT NULL,
       "player_id" text,
       "kind" text NOT NULL,
       "currency" text NOT NULL,
       "balance_minor" integer DEFAULT 0 NOT NULL,
       "version" integer DEFAULT 0 NOT NULL,
       "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
       "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
     );
     CREATE UNIQUE INDEX IF NOT EXISTS "ledger_accounts_owner_kind_currency_unique" ON "ledger_accounts" ("player_id", "kind", "currency");
     CREATE INDEX IF NOT EXISTS "ledger_accounts_player_idx" ON "ledger_accounts" ("player_id");
     CREATE TABLE IF NOT EXISTS "ledger_transactions" (
       "id" text PRIMARY KEY NOT NULL,
       "idempotency_key" text NOT NULL,
       "round_id" text,
       "kind" text NOT NULL,
       "status" text DEFAULT 'PENDING' NOT NULL,
       "request_hash" text NOT NULL,
       "posted_at" text,
       "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
     );
     CREATE UNIQUE INDEX IF NOT EXISTS "ledger_transactions_idempotency_unique" ON "ledger_transactions" ("idempotency_key");
     CREATE INDEX IF NOT EXISTS "ledger_transactions_round_idx" ON "ledger_transactions" ("round_id");
     CREATE TABLE IF NOT EXISTS "ledger_entries" (
       "id" text PRIMARY KEY NOT NULL,
       "transaction_id" text NOT NULL,
       "account_id" text NOT NULL,
       "sequence" integer NOT NULL,
       "amount_minor" integer NOT NULL,
       "currency" text NOT NULL,
       "balance_after_minor" integer NOT NULL,
       "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
     );
     CREATE UNIQUE INDEX IF NOT EXISTS "ledger_entries_transaction_sequence_unique" ON "ledger_entries" ("transaction_id", "sequence");
     CREATE INDEX IF NOT EXISTS "ledger_entries_account_created_idx" ON "ledger_entries" ("account_id", "created_at");
     CREATE TABLE IF NOT EXISTS "audit_events" (
       "id" text PRIMARY KEY NOT NULL,
       "actor_type" text NOT NULL,
       "actor_id" text NOT NULL,
       "event_type" text NOT NULL,
       "subject_type" text NOT NULL,
       "subject_id" text NOT NULL,
       "event_json" text NOT NULL,
       "previous_hash" text,
       "event_hash" text NOT NULL,
       "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
     );
     CREATE UNIQUE INDEX IF NOT EXISTS "audit_events_event_hash_unique" ON "audit_events" ("event_hash");
     CREATE INDEX IF NOT EXISTS "audit_events_subject_created_idx" ON "audit_events" ("subject_type", "subject_id", "created_at");`;

  sqlite.exec(migrationSql);
  return { sqlite, db };
}

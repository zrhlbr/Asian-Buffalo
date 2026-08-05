CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`event_type` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`event_json` text NOT NULL,
	`previous_hash` text,
	`event_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_events_event_hash_unique` ON `audit_events` (`event_hash`);--> statement-breakpoint
CREATE INDEX `audit_events_subject_created_idx` ON `audit_events` (`subject_type`,`subject_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `game_math_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`sha256` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`config_json` text NOT NULL,
	`activated_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_math_versions_sha256_unique` ON `game_math_versions` (`sha256`);--> statement-breakpoint
CREATE TABLE `game_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`player_id` text NOT NULL,
	`math_version_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`result_hash` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`currency` text NOT NULL,
	`total_bet_minor` integer NOT NULL,
	`total_win_minor` integer,
	`balance_after_minor` integer,
	`is_free_game` integer DEFAULT false NOT NULL,
	`outcome_json` text,
	`settled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `game_sessions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`math_version_id`) REFERENCES `game_math_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "game_rounds_bet_nonnegative" CHECK("game_rounds"."total_bet_minor" >= 0),
	CONSTRAINT "game_rounds_win_nonnegative" CHECK("game_rounds"."total_win_minor" IS NULL OR "game_rounds"."total_win_minor" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_rounds_player_idempotency_unique` ON `game_rounds` (`player_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `game_rounds_session_created_idx` ON `game_rounds` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `game_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`math_version_id` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`free_games_remaining` integer DEFAULT 0 NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`math_version_id`) REFERENCES `game_math_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "game_sessions_free_games_nonnegative" CHECK("game_sessions"."free_games_remaining" >= 0)
);
--> statement-breakpoint
CREATE INDEX `game_sessions_player_status_idx` ON `game_sessions` (`player_id`,`status`);--> statement-breakpoint
CREATE TABLE `ledger_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text,
	`kind` text NOT NULL,
	`currency` text NOT NULL,
	`balance_minor` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_accounts_owner_kind_currency_unique` ON `ledger_accounts` (`player_id`,`kind`,`currency`);--> statement-breakpoint
CREATE INDEX `ledger_accounts_player_idx` ON `ledger_accounts` (`player_id`);--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`account_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`balance_after_minor` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `ledger_transactions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`account_id`) REFERENCES `ledger_accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ledger_entries_amount_nonzero" CHECK("ledger_entries"."amount_minor" <> 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_entries_transaction_sequence_unique` ON `ledger_entries` (`transaction_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `ledger_entries_account_created_idx` ON `ledger_entries` (`account_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ledger_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`round_id` text,
	`kind` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`request_hash` text NOT NULL,
	`posted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `game_rounds`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_transactions_idempotency_unique` ON `ledger_transactions` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `ledger_transactions_round_idx` ON `ledger_transactions` (`round_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_adapter_ref` text NOT NULL,
	`currency` text DEFAULT 'MMK' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "players_currency_length" CHECK(length("players"."currency") = 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_wallet_adapter_ref_unique` ON `players` (`wallet_adapter_ref`);
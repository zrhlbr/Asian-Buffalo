-- Rebuild game_rounds with lease/recovery columns + CHECKs (D1-compatible).
-- Child ledger_transactions.round_id FKs are deferred across the rebuild.
PRAGMA defer_foreign_keys = on;
--> statement-breakpoint
CREATE TABLE `game_rounds_new` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`player_id` text NOT NULL,
	`math_version_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`request_payload` text,
	`result_hash` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`currency` text NOT NULL,
	`total_bet_minor` integer NOT NULL,
	`total_win_minor` integer,
	`balance_after_minor` integer,
	`is_free_game` integer DEFAULT false NOT NULL,
	`outcome_json` text,
	`settled_at` text,
	`claim_token` text,
	`lease_expires_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`free_game_reserved` integer DEFAULT false NOT NULL,
	`free_games_awarded` integer DEFAULT 0 NOT NULL,
	`wallet_applied` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `game_sessions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`math_version_id`) REFERENCES `game_math_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "game_rounds_bet_nonnegative" CHECK("total_bet_minor" >= 0),
	CONSTRAINT "game_rounds_win_nonnegative" CHECK("total_win_minor" IS NULL OR "total_win_minor" >= 0),
	CONSTRAINT "game_rounds_free_games_awarded_nonnegative" CHECK("free_games_awarded" >= 0)
);
--> statement-breakpoint
INSERT INTO `game_rounds_new` (
	`id`, `session_id`, `player_id`, `math_version_id`, `idempotency_key`, `request_hash`,
	`request_payload`, `result_hash`, `status`, `currency`, `total_bet_minor`, `total_win_minor`,
	`balance_after_minor`, `is_free_game`, `outcome_json`, `settled_at`,
	`claim_token`, `lease_expires_at`, `updated_at`,
	`free_game_reserved`, `free_games_awarded`, `wallet_applied`, `created_at`
)
SELECT
	`id`, `session_id`, `player_id`, `math_version_id`, `idempotency_key`, `request_hash`,
	`request_payload`, `result_hash`, `status`, `currency`, `total_bet_minor`, `total_win_minor`,
	`balance_after_minor`, `is_free_game`, `outcome_json`, `settled_at`,
	NULL, NULL, `created_at`,
	false, 0, false, `created_at`
FROM `game_rounds`;
--> statement-breakpoint
DROP TABLE `game_rounds`;
--> statement-breakpoint
ALTER TABLE `game_rounds_new` RENAME TO `game_rounds`;
--> statement-breakpoint
CREATE UNIQUE INDEX `game_rounds_player_idempotency_unique` ON `game_rounds` (`player_id`, `idempotency_key`);
--> statement-breakpoint
CREATE INDEX `game_rounds_session_created_idx` ON `game_rounds` (`session_id`, `created_at`);
--> statement-breakpoint
PRAGMA defer_foreign_keys = off;

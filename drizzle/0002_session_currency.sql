-- D1-compatible: defer_foreign_keys (NOT foreign_keys=OFF).
-- Rebuild game_sessions to enforce currency NOT NULL + format CHECKs.
-- Illegal historical rows cause the migration to ABORT (no silent drops).
PRAGMA defer_foreign_keys = on;
--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `currency` text;
--> statement-breakpoint
UPDATE `game_sessions`
SET `currency` = (
	SELECT `players`.`currency`
	FROM `players`
	WHERE `players`.`id` = `game_sessions`.`player_id`
)
WHERE `currency` IS NULL;
--> statement-breakpoint
CREATE TABLE `__ab_m0002_currency_guard` (
	`ok` integer NOT NULL,
	CONSTRAINT `__ab_m0002_currency_guard_ok` CHECK (`ok` = 1)
);
--> statement-breakpoint
INSERT INTO `__ab_m0002_currency_guard` (`ok`)
SELECT CASE
	WHEN EXISTS (
		SELECT 1
		FROM `game_sessions`
		WHERE `currency` IS NULL
			OR length(`currency`) != 3
			OR `currency` NOT GLOB '[A-Z][A-Z][A-Z]'
	) THEN 0
	ELSE 1
END;
--> statement-breakpoint
DROP TABLE `__ab_m0002_currency_guard`;
--> statement-breakpoint
CREATE TABLE `game_sessions_new` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`math_version_id` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`currency` text NOT NULL,
	`free_games_remaining` integer DEFAULT 0 NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`math_version_id`) REFERENCES `game_math_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "game_sessions_free_games_nonnegative" CHECK("free_games_remaining" >= 0),
	CONSTRAINT "game_sessions_currency_length" CHECK(length("currency") = 3),
	CONSTRAINT "game_sessions_currency_format" CHECK("currency" GLOB '[A-Z][A-Z][A-Z]')
);
--> statement-breakpoint
INSERT INTO `game_sessions_new` (
	`id`, `player_id`, `math_version_id`, `status`, `currency`,
	`free_games_remaining`, `expires_at`, `created_at`, `updated_at`
)
SELECT
	`id`,
	`player_id`,
	`math_version_id`,
	`status`,
	`currency`,
	`free_games_remaining`,
	`expires_at`,
	`created_at`,
	`updated_at`
FROM `game_sessions`;
--> statement-breakpoint
DROP TABLE `game_sessions`;
--> statement-breakpoint
ALTER TABLE `game_sessions_new` RENAME TO `game_sessions`;
--> statement-breakpoint
CREATE INDEX `game_sessions_player_status_idx` ON `game_sessions` (`player_id`,`status`);
--> statement-breakpoint
PRAGMA defer_foreign_keys = off;

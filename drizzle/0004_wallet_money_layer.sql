CREATE TABLE `ledger_balances` (
	`account_id` text PRIMARY KEY NOT NULL,
	`balance_minor` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `ledger_accounts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `wallet_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`operation` text NOT NULL,
	`status` text DEFAULT 'NEW' NOT NULL,
	`currency` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`request_hash` text NOT NULL,
	`provider_op_id` text,
	`ledger_tx_id` text,
	`result_json` text,
	`error_code` text,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT `wallet_intents_amount_nonnegative` CHECK(`amount_minor` >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_intents_player_idempotency_unique` ON `wallet_intents` (`player_id`,`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `wallet_intents_status_idx` ON `wallet_intents` (`status`);
--> statement-breakpoint
CREATE TABLE `wallet_provider_ops` (
	`id` text PRIMARY KEY NOT NULL,
	`intent_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'NEW' NOT NULL,
	`currency` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`direction` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`intent_id`) REFERENCES `wallet_intents`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT `wallet_provider_ops_amount_nonnegative` CHECK(`amount_minor` >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_provider_ops_idempotency_unique` ON `wallet_provider_ops` (`idempotency_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_provider_ops_intent_unique` ON `wallet_provider_ops` (`intent_id`);
--> statement-breakpoint
CREATE INDEX `wallet_provider_ops_status_idx` ON `wallet_provider_ops` (`status`);

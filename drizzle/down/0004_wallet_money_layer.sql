-- Rollback for 0004_wallet_money_layer (reverse order of FK dependents).
DROP INDEX IF EXISTS `wallet_provider_ops_status_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `wallet_provider_ops_intent_unique`;
--> statement-breakpoint
DROP INDEX IF EXISTS `wallet_provider_ops_idempotency_unique`;
--> statement-breakpoint
DROP TABLE IF EXISTS `wallet_provider_ops`;
--> statement-breakpoint
DROP INDEX IF EXISTS `wallet_intents_status_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `wallet_intents_player_idempotency_unique`;
--> statement-breakpoint
DROP TABLE IF EXISTS `wallet_intents`;
--> statement-breakpoint
DROP TABLE IF EXISTS `ledger_balances`;

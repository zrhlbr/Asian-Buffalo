/**
 * Migration version gate for the money layer.
 * Forward: 0000..0004. Rollback: down/0004 then prior.
 */

export const MONEY_LAYER_MIGRATION_VERSION = 4;
export const MONEY_LAYER_MIGRATION_TAG = "0004_wallet_money_layer";

export const FORWARD_MIGRATION_TAGS = [
  "0000_early_power_pack",
  "0001_steady_annihilus",
  "0002_session_currency",
  "0003_round_lease",
  "0004_wallet_money_layer",
] as const;

export function assertMigrationVersionAtLeast(
  appliedVersion: number,
  required = MONEY_LAYER_MIGRATION_VERSION,
): void {
  if (!Number.isSafeInteger(appliedVersion) || appliedVersion < required) {
    throw new Error(
      `Fail-closed: migration version ${appliedVersion} < required ${required}`,
    );
  }
}

# WALLET_LEDGER_ADMIN_REPORT

## Wallet — CONNECTED (RO)
- Intents + provider ops list/filter/page.
- Intent detail `GET wallet/intents/:id` with timeline (`intent.created`, `provider_op`).
- No admin balance mutation endpoints.

## Ledger — CONNECTED (RO)
- Accounts / transactions / entries / balances / health.
- Transaction filters: status + **kind**.
- Health flags unbalanced POSTED txs + projection mismatches.
- No edit/delete of historical ledger.

## Money safety
- Admin API does not raw-UPDATE wallet/ledger balances.
- Future ADMIN_ADJUSTMENT must go Wallet Service + Ledger + Audit (not opened this round).

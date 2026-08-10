# ADMIN-1D Ledger Report

| Item | Result |
|------|--------|
| Ledger list | YES — server-side pagination |
| Ledger detail | YES — `GET ledger/transactions/:id` |
| Real data | YES — `ledger_transactions` / `ledger_entries` |
| Search | Ledger ID / Player ID / Reference / Round / Spin / Deposit / Withdrawal order hints |
| Filters | Currency / Type / Direction / Status / date range (≤93d) |
| Amounts | Unified `fmtMinor` (minor/100) |
| Trace | Player ↔ Round ↔ Spin ↔ Ledger bidirectional UI links |

## Detail fields

Ledger ID, Player ID, Wallet ID, Currency, Type, Direction, Amount, Balance Before/After (derived), Reference Type/ID, Status, Idempotency Key, Request Hash, Entries, Reconciliation status.

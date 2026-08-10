# ADMIN_1C_RECONCILIATION_REPORT

## Scope
READ-ONLY reconciliation on Round/Spin detail. **No auto-repair. No DB writes to ledger/wallet/rounds.**

## Checks
| Code | Meaning |
|------|---------|
| ROUND_INCOMPLETE | status PENDING |
| SPIN_MISSING_LEDGER_REFERENCE | SETTLED with 0 ledger tx |
| WALLET_NOT_APPLIED | SETTLED + wallet_applied=0 |
| DUPLICATE_LEDGER_REFERENCE | duplicate BET/PAYOUT kinds |
| BALANCE_EQUATION_MISMATCH | after ≠ before − bet + win (before DERIVED) |
| VOID_WITH_WIN | VOID with non-zero win |

## Anomaly feed
`GET /api/admin/games/:id/anomalies` + Game Ops panel (discover/display only).

## Result
RECONCILIATION: **ISSUES FOUND** capability live (flags missing ledger on settled rounds). Healthy seeded round with ledger → ok=true in tests.

When an issue is shown, UI records Round ID / Spin ID / Ledger Reference / Expected / Actual — never silent-fix.

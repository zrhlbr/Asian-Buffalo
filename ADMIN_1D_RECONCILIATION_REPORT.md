# ADMIN-1D Reconciliation Report

| Check | Status |
|-------|--------|
| Entry Σ amount_minor == 0 (POSTED) | Via ledger health + detail `reconciliation.status` |
| Player before + amount = after | Detail `playerCheck` MATCH/MISMATCH/UNKNOWN |
| Round/Spin ↔ Ledger missing ref | Integrity: `MISSING_REFERENCE` |
| Duplicate GAME_PAYOUT refs | Integrity: `DUPLICATE_REFERENCE` |
| Negative available | Integrity: `NEGATIVE_BALANCE` |
| Abnormal frozen holds | Integrity: `ABNORMAL_FROZEN` |
| Auto-fix | **NO** (`autoFix: false`) |

## Verdict

**MONEY RECONCILIATION: PASS** (read-only discover; issues reported, never auto-repaired)

# WITHDRAWAL_FLOW.md

**Status:** CONTRACT ONLY — Phase 6 paused on BR-006.

## Target states
`PENDING → UNDER_REVIEW → APPROVED → PAYING → PAID | REJECTED | CANCELLED`

Admin review requires RBAC + Audit reason. Debit/hold via MoneyService / ledger transit — never raw UPDATE balance. Mask PII on channel accounts.

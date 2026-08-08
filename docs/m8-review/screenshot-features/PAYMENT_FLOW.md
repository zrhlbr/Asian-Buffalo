# PAYMENT_FLOW.md

**Status:** CONTRACT ONLY — Phase 5–7 paused on BR-005 / BR-007.

## Target flow
1. Admin configures `depositPresets[]` + payment channels (KBZ/Wave/TRC20/…).
2. Player creates Deposit Order (server amount from preset only).
3. Provider callback → Wallet Intent → Ledger DEPOSIT (idempotent).
4. Fail closed on unknown callback / amount mismatch.

## FE
`#wallet-modal` shows pending copy until rails live. Do not fake credits.

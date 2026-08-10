# ADMIN-1E Money Integrity → Risk Link Report

## Principle

Risk Center **consumes** ADMIN-1D `listMoneyIntegrityExceptions`.  
It does **not** duplicate repair / matching logic.

## Flow

```
listMoneyIntegrityExceptions(db)
  → map code/severity → risk Candidate
  → fingerprint upsert into admin_risk_events
  → category WALLET | LEDGER
```

Integrity codes preserved (examples): MATCH (not raised as open risk), MISMATCH, MISSING_REFERENCE, DUPLICATE_REFERENCE, UNKNOWN — mapped to Risk Level from integrity severity.

## UI / overview

- Wallet/Ledger open counts from `admin_risk_events` categories WALLET|LEDGER
- Player risk view surfaces those events with links to Wallet / Ledger / Round / Spin when subject ids allow
- Wallet Center integrity endpoint remains the source of truth for investigation detail

## Guardrails

- No auto ledger/round/spin mutation from Risk status changes
- PRODUCTION MONEY GATE CLOSED unchanged
- No second integrity scanner

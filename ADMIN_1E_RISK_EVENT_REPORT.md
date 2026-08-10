# ADMIN-1E Risk Event Report

## Model (`admin_risk_events`)

| Field | Notes |
|-------|-------|
| Risk ID | UUID |
| Player ID | nullable |
| Type | e.g. HIGH_FREQ_SPIN, MISMATCH, MULTI_IP_SWITCH |
| Category | AUTH / SESSION / DEVICE / IP / GAMEPLAY / WALLET / LEDGER / DEPOSIT / WITHDRAWAL / ADMIN_SECURITY |
| Level | LOW / MEDIUM / HIGH / CRITICAL |
| Status | OPEN / REVIEWING / RESOLVED / DISMISSED |
| Detected At / Last Updated | ISO timestamps |
| Evidence Summary | short rule-backed text |
| Related Reference | round/spin/ledger/order id when known |
| Fingerprint | unique; upserts OPEN/REVIEWING; never reopens RESOLVED/DISMISSED |

## Detection sources (extended, not replaced)

1. Existing `getRiskSignals` (gameplay / session style signals)
2. `listMoneyIntegrityExceptions` (ADMIN-1D) — consumed, not copied
3. Deposit/withdraw anomaly queries (duplicate dest, frequency) — PARTIAL
4. Optional `player_auth_sessions` multi-IP — PARTIAL when table present

## Manual workflow

```
OPEN → REVIEWING → RESOLVED | DISMISSED
```

- Reason + operator + timestamp required on terminal states
- Writes Admin Action Audit (`risk.status.change` / notes)
- **Never** auto-triggers freeze, ban, withdraw reject, or balance change

## Notes

`admin_risk_notes`: append-only (admin, time, note). No edit/overwrite of history. Internal only — not exposed to players.

## Filters / pagination

Player ID, Risk ID, Type, Level, Status, time range — server-side pagination on `GET risk/events`.

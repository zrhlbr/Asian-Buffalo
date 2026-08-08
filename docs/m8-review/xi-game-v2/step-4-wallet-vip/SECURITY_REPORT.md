# SECURITY_REPORT — Step 4

| Threat | Control |
|--------|---------|
| Double deposit credit | Unique order idempotency + MoneyService intent; SUCCESS short-circuit |
| Double withdraw debit | Unique request idempotency; hold once; release key unique |
| Double reward / check-in / activity | Unique claim keys; alreadyClaimed path |
| Cross-player access | playerId from identity; order/request ownership checks |
| Client amount / VIP / status forgery | Server validates presets/config; rejects client amountMinor/balance/status |
| Live provider spoofing | Confirm fail-closed without test identity / secrets (BR-007) |
| Admin abuse | RBAC permissions + reason required + admin_audit_logs |
| PII leak | Withdrawal account masked in list APIs |

**Invariants:** no raw balance UPDATE; no client-mutated balances; MoneyService adapters only for money moves.

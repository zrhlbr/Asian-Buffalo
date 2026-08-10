# ADMIN-1E RBAC Report

## Permissions added / used

| Permission | Purpose |
|------------|---------|
| `risk:view` | Overview, events, player risk, signals |
| `risk:manage` | Status change + risk notes |
| `risk:pii:view` | Unmask risk-related IP / fingerprint when combined with players PII rules |
| `logs:view` | Audit Center (admin / game / security) |

Export permission `audit:export` — **not opened** (CSV = FUTURE).

## Role matrix (relevant)

| Role | Risk | Audit | Notes |
|------|------|-------|-------|
| SUPER_ADMIN | * | * | Still audited |
| RISK | view + manage + pii + integrity/wallet/ledger evidence | logs:view | Primary operator |
| FINANCE | risk:view (no manage) + integrity | logs:view | Money integrity RO |
| OPS | risk:view | logs:view | Limited summary |
| SUPPORT / CS | no risk:view by default | — | Limited player hints only via other modules |
| TECH | no risk/rounds as before | — | unchanged |

## Backend enforcement

Tested:

- No admin token → 401
- Player token → 401/403
- Admin without permission → 403
- Correct permission → 200

Menu hide alone is insufficient; handlers require permissions.

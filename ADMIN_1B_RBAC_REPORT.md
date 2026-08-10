# ADMIN_1B_RBAC_REPORT

## New permissions (additive)
| Permission | Purpose |
|------------|---------|
| `players:pii:view` | Full phone/email/IP/device |
| `players:sessions:view` | Session section / IDs |
| `players:devices:view` | Device tab access (values still masked w/o pii) |
| `players:session:revoke` | Force revoke (was `system:manage`) |

## Role grants (delta)
| Role | pii | sessions | devices | revoke |
|------|-----|----------|---------|--------|
| SUPER_ADMIN | * | * | * | * |
| OPS | no | yes | no | yes |
| SUPPORT | no | yes | no | no |
| RISK | yes | yes | yes | yes |
| AUDIT | yes | yes | yes | no |
| READONLY | no | yes | yes | no |
| FINANCE/TECH | — | — | — | — |

API enforces all permissions; UI `can()` hides actions only as UX.
Regression: READONLY still cannot freeze (r1-m7 19/19 + 1B 10/10).

# RBAC_MATRIX — Step 4 additive permissions

| Permission | SUPER_ADMIN | OPS | SUPPORT | FINANCE | RISK | AUDIT | TECH | READONLY |
|------------|-------------|-----|---------|---------|------|-------|------|----------|
| deposit:view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| deposit:manage | ✓ | ✓ | — | ✓ | — | — | — | — |
| withdraw:view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| withdraw:review | ✓ | ✓ | — | ✓ | ✓ | — | — | — |
| withdraw:pay | ✓ | — | — | ✓ | — | — | — | — |
| activity:view | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| activity:manage | ✓ | ✓ | — | — | — | — | ✓ | — |
| vip:view / vip:manage | (existing) | | | | | | | |

Dangerous (reason + audit): `deposit:manage`, `withdraw:review`, `withdraw:pay`, `activity:manage`.

# RBAC_MATRIX.md

New permissions (additive):

| Permission | SUPER_ADMIN | OPS | SUPPORT | FINANCE | RISK | AUDIT | TECH | READONLY |
|------------|-------------|-----|---------|---------|------|-------|------|----------|
| vip:view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| vip:manage | ✓ | ✓ | — | — | — | — | — | — |

Existing money invariants unchanged: no admin raw balance edit; VIP assign does not credit wallet; reward credit is player claim via MoneyService only.

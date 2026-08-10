# ADMIN_1C_RBAC_REPORT

## Convention
Existing colon permissions retained. Spec labels map as:

| Spec label | Implemented gate |
|------------|------------------|
| games.view | `rounds:view` |
| games.rounds.view | `rounds:view` |
| games.spins.view | `rounds:view` |
| games.health.view | `rounds:view` |

No parallel permission system created.

## Roles with `rounds:view`
SUPER_ADMIN(*), OPS, SUPPORT, FINANCE, RISK, AUDIT, READONLY  
**TECH:** no `rounds:view` (math:view only) — cannot open Games/Rounds/Spins APIs.

## API enforcement
- No Admin Token → **401**
- Admin without permission → **403**
- Frontend menu hide alone is insufficient (backend `get(..., "rounds:view", ...)`).

## Audit
Round/Spin detail views write `rounds.detail.view` / `spins.detail.view`.  
No state-change Games APIs opened in 1C.

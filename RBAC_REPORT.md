# RBAC_REPORT

## Isolation
Admin accounts (`admin_users`) ≠ player accounts. Cookie `ab_admin` only.

## Roles → intent
| Product intent | Role |
|----------------|------|
| Super Admin | SUPER_ADMIN |
| Operations | OPS |
| Finance | FINANCE |
| Customer Service | SUPPORT |
| Risk | RISK |
| Auditor | AUDIT / READONLY |
| Tech | TECH |

## Enforcement
- Every `/api/admin/*` (except login) checks `roleHasPermission`.
- Mutating ops need `reason` + audit log.
- UI nav filters by `permissions` returned from login/`me` (SUPER_ADMIN always full).
- Hiding menu alone is insufficient — API 403 remains source of truth.

## Tests
READONLY denied freeze/admins create — covered in `r1-m7-admin.test.mjs`.

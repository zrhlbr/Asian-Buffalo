# RBAC MATRIX (Admin)

Backend enforces 403 even if UI is bypassed. UI nav uses `permissions[]` from login/`/me`.

| Role | dashboard | players | freeze | rounds/sessions/spins | wallet | ledger | math | risk | system view | system manage | logs | admins view | admins manage |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SUPER_ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OPS | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| SUPPORT | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| FINANCE | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| RISK | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| AUDIT / READONLY | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| TECH | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |

Dangerous mutations require `reason` ≥ 2 chars + `admin_audit_logs` row.
Player APIs have no admin RBAC — they use player identity gate (fail-closed unless test identity).

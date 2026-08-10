# ADMIN_RBAC_MATRIX

**Phase:** ADMIN-1A  
**Date:** 2026-08-09  
**Source of truth:** `lib/admin/admin-auth.ts` (`ADMIN_ROLES`, `ADMIN_PERMISSIONS`, `ROLE_PERMISSIONS`)  
**Enforcement:** `lib/admin/admin-api.ts` → `roleHasPermission` on every authenticated route  
**UI:** `can(permission)` filters nav + action buttons（不足以为唯一控制）

---

## 1. Current roles

| Role | Product intent | Status |
|------|----------------|--------|
| SUPER_ADMIN | 超级管理员 | IMPLEMENTED (`*`) |
| OPS | 运营 | IMPLEMENTED |
| SUPPORT | 客服 (CUSTOMER_SERVICE) | IMPLEMENTED (name differs) |
| FINANCE | 财务 | IMPLEMENTED |
| RISK | 风控 | IMPLEMENTED |
| AUDIT | 审计 | IMPLEMENTED (ALL_VIEW) |
| TECH | 技术/运维 | IMPLEMENTED |
| READONLY | 只读 | IMPLEMENTED (ALL_VIEW) |
| CONTENT | 内容 | **MISSING** |
| CUSTOMER_SERVICE (exact name) | 客服 | **MISSING** alias — use SUPPORT |

---

## 2. Current permissions vs ADMIN-1 target

| Target (ADMIN-1) | Current key | Status |
|------------------|-------------|--------|
| dashboard.view | `dashboard:view` | IMPLEMENTED |
| players.view | `players:view` | IMPLEMENTED |
| players.freeze | `players:freeze` | IMPLEMENTED |
| players.ban | — | MISSING (close uses `players:freeze`) |
| players.session.revoke | — | MISSING (revoke uses `system:manage`) |
| games.view | — | MISSING (uses `rounds:view`) |
| rounds.view | `rounds:view` | IMPLEMENTED |
| wallet.view | `wallet:view` | IMPLEMENTED |
| wallet.adjust | — | **BLOCKED / MISSING** |
| deposit.view / review | `deposit:view` / `deposit:manage` | PARTIAL naming |
| withdraw.view / review | `withdraw:view` / `withdraw:review` / `withdraw:pay` | PARTIAL |
| risk.view | `risk:view` | IMPLEMENTED |
| risk.manage | — | MISSING |
| content.view / edit / publish | — | MISSING (uses `system:view|manage`) |
| support.view / reply | — | MISSING (uses `system:*`) |
| audit.view | `logs:view` | PARTIAL naming |
| admin.manage | `admins:view` / `admins:manage` | IMPLEMENTED |
| vip / activity | `vip:*` / `activity:*` | IMPLEMENTED |
| math.view | `math:view` | IMPLEMENTED |
| system.view / manage | `system:view` / `system:manage` | IMPLEMENTED |
| ledger.view | `ledger:view` | IMPLEMENTED |

---

## 3. Role × permission (current)

| Permission | SUPER | OPS | SUPPORT | FINANCE | RISK | AUDIT | TECH | READONLY |
|------------|:-----:|:---:|:-------:|:-------:|:----:|:-----:|:----:|:--------:|
| dashboard:view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| players:view | ✓ | ✓ | ✓ | | ✓ | ✓ | | ✓ |
| players:freeze | ✓ | ✓ | | | ✓ | | | |
| rounds:view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| wallet:view | ✓ | | ✓ | ✓ | | ✓ | | ✓ |
| ledger:view | ✓ | | | ✓ | | ✓ | | ✓ |
| math:view | ✓ | | | | | ✓ | ✓ | ✓ |
| risk:view | ✓ | ✓ | | | ✓ | ✓ | | ✓ |
| system:view | ✓ | ✓ | | | | ✓ | ✓ | ✓ |
| system:manage | ✓ | ✓ | | | | | ✓ | |
| logs:view | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ |
| admins:view | ✓ | | | | | ✓ | | ✓ |
| admins:manage | ✓ | | | | | | | |
| vip:view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| vip:manage | ✓ | ✓ | | | | | | |
| deposit:view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| deposit:manage | ✓ | ✓ | | ✓ | | | | |
| withdraw:view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| withdraw:review | ✓ | ✓ | | ✓ | ✓ | | | |
| withdraw:pay | ✓ | | | ✓ | | | | |
| activity:view | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | ✓ |
| activity:manage | ✓ | ✓ | | | | | ✓ | |

---

## 4. Dangerous operations (current)

Flagged in API matrix UI (`DANGEROUS_PERMISSIONS`):
- `players:freeze`
- `system:manage`
- `admins:manage`
- `deposit:manage`
- `withdraw:review`
- `withdraw:pay`
- `activity:manage`

Mutations require **reason ≥ 2 chars** + **admin_audit_logs** row (operator, action, target, reason, IP, detail_json, time).

Gaps vs ADMIN-1 strict audit:
- No structured **Before / After** columns
- No **Request ID**
- No **Role** column on audit row (derivable via join)
- Session revoke not under player-scoped permission

---

## 5. Frontend vs Backend

| Control | Status |
|---------|--------|
| Menu hidden without permission | YES |
| Action buttons gated (`can`) | YES for freeze/close/manage |
| API 403 without permission | YES |
| Rely on UI hide alone | **NO** — backend enforced |

---

## 6. ADMIN-1A RBAC verdict

**ADMIN RBAC: PARTIAL**

- Real multi-role model exists and is enforced server-side.
- Not yet aligned to ADMIN-1 fine-grained permission catalog / CONTENT role.
- Do **not** rewrite RBAC in 1B; additive remap planned in 1A freeze → implement gradually 1B–1G without breaking existing keys (prefer alias or dual-accept during migration).

### Freeze decision (architecture)

1. Keep existing `resource:action` keys for compatibility.  
2. Additive new permissions only when module lands (e.g. `risk:manage` in 1E).  
3. Map CONTENT → new role with content perms; until then OPS/TECH `system:manage`.  
4. `wallet:adjust` remains absent until dedicated security phase.  
5. Never grant all operators SUPER_ADMIN in production bootstrap docs.

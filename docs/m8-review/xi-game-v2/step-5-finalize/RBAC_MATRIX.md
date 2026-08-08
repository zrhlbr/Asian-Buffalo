# RBAC_MATRIX — Step 5 (carries Step 4)

| Permission | SUPER_ADMIN | OPS | SUPPORT | FINANCE | RISK | AUDIT | TECH | READONLY |
|------------|-------------|-----|---------|---------|------|-------|------|----------|
| deposit:view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| deposit:manage | ✓ | ✓ | — | ✓ | — | — | — | — |
| withdraw:view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| withdraw:review | ✓ | ✓ | — | ✓ | ✓ | — | — | — |
| withdraw:pay | ✓ | — | — | ✓ | — | — | — | — |
| activity:view | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| activity:manage | ✓ | ✓ | — | — | — | — | ✓ | — |
| wallet:view / ledger:view / math:view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| wallet/ledger/math write | — | — | — | — | — | — | — | — |

## Verified

| Check | Result |
|-------|--------|
| Missing session → 401 | PASS (`r1-m7-admin.test.mjs`) |
| Read-only role denied dangerous ops → 403 | PASS |
| Finance can review withdraw; support cannot pay | PASS (`step4-wallet-vip.test.mjs`) |
| Write APIs require permission | PASS |

Dangerous ops require `reason` + `admin_audit_logs` row.

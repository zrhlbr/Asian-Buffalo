# ADMIN_PRODUCTION_REGRESSION_REPORT

**Date (UTC):** 2026-08-10  
**Source HEAD:** `9654d4194d2db801467af34cef1ddc5650fd310f`（dirty allowlist）  

## Candidate unit / integration（重新执行）

| Suite | Result |
|---|---|
| `tests/r1-m9-admin-1b.test.mjs` … `1g` | **42/42 PASS** |
| Prior citation only | **禁止 / 未使用** |

## Production post-deploy regression

| Area | Result |
|---|---|
| Player public routes | PASS（200） |
| Admin login / me gate | PASS |
| Dashboard real metrics | PASS |
| Players list（email 列修复后） | PASS |
| Games / Rounds / Spins | PASS |
| Wallet / Ledger / Integrity | PASS |
| Risk / Audit logs | PASS |
| Content / Activity / VIP | PASS |
| Support tickets | PASS |
| Admins / Roles / Sessions / Security | PASS |
| Money confirm/pay | PASS fail-closed |
| S-18 publish incomplete | PASS reject |
| RNG/RTP/Math/Paytable/Spin core | **未修改** |

## First-deploy defect（已修复）

| ID | Symptom | Fix |
|---|---|---|
| P0-PLAYERS-EMAIL | `/api/admin/players` → `no such column: pf.email` | 部署 M9 `player-commerce-bootstrap` 加性 `ALTER … ADD COLUMN email` 并重建镜像 |

## Known non-regression limitations

| Item | Status |
|---|---|
| PLAYER CONTENT SYNC | PARTIAL |
| ADMIN-1H | 未完成 |
| Roles dynamic edit | 保持 `editable=false` |

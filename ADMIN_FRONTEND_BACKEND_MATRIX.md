# ADMIN_FRONTEND_BACKEND_MATRIX

**Date:** 2026-08-08  
**Workspace:** `D:\Asian-Buffalo-R1-M9-Cursor-Clean`  
**Baseline HEAD:** `9654d4194d2db801467af34cef1ddc5650fd310f`

| Module | UI | API | Auth | RBAC | Database | Tests | Production | Status |
|--------|----|-----|------|------|----------|-------|------------|--------|
| Login `/admin` + `/admin/login` | YES | login/logout/me | Cookie+Bearer `ab_admin` | N/A | admin_users/sessions | Unit | Live 200; bad login 401 | CONNECTED |
| Dashboard | YES | GET dashboard (+trend7d) | YES | dashboard:view | players/rounds/sessions/wallet/deposit/withdraw | Unit | **Not deployed** new fields | PARTIAL |
| Players | YES | list/detail/freeze/unfreeze/close/reopen | YES | players:* | players + profiles + vip | Unit freeze | BLOCKED deploy | CONNECTED* |
| Sessions | YES | list/detail/revoke | YES | rounds:view / system:manage | game_sessions | Unit RO | BLOCKED deploy | CONNECTED* |
| Rounds | YES | list/detail | YES | rounds:view | game_rounds | Unit | BLOCKED deploy | CONNECTED |
| Spins | YES | alias rounds | YES | rounds:view | game_rounds | Unit | BLOCKED deploy | CONNECTED |
| Games | YES | GET games | YES | rounds:view | aggregates | — | BLOCKED deploy | CONNECTED* |
| 牛魔王 Ops | YES | GET games/:id/ops | YES | rounds:view | rounds/outcome | — | BLOCKED deploy | CONNECTED* |
| Wallet | YES | intents/ops/detail | YES | wallet:view | wallet_* | Unit detail | BLOCKED deploy | CONNECTED |
| Ledger | YES | accounts/tx/entries/balances/health | YES | ledger:view | ledger_* | Unit health/kind | BLOCKED deploy | CONNECTED |
| Deposits | YES | list/config/confirm | YES | deposit:* | deposit_orders | — | Live confirm → PROVIDER_NOT_CONFIGURED | PARTIAL |
| Withdrawals | YES | list/approve/reject/pay | YES | withdraw:* | withdrawal_requests | — | TEST money path | PARTIAL |
| VIP | YES | levels/players | YES | vip:* | vip_* | — | BLOCKED deploy | PARTIAL |
| Activities | YES | list/upsert | YES | activity:* | player_activities | — | Reward via MoneyService on claim | PARTIAL |
| Announcements | YES | CRUD publish | YES | system:* | admin_announcements | Unit draft/locales | BLOCKED deploy | CONNECTED* |
| Rankings | YES | reports/ops rankings | YES | dashboard:view | game_rounds agg | Unit dau/rank | BLOCKED deploy | CONNECTED* |
| Reports | YES | reports/ops | YES | dashboard:view | agg | Unit | BLOCKED deploy | CONNECTED |
| Risk | YES | risk/signals | YES | risk:view | heuristics | Unit HF | BLOCKED deploy | CONNECTED |
| Support / CS | YES | system/config support_info | YES | system:* | admin_system_config | — | BLOCKED deploy | CONNECTED* |
| Audit Log | YES | logs/admin + logs/game | YES | logs:view | admin_audit_logs | Unit audit write | BLOCKED deploy | CONNECTED* |
| System Health | YES | system/status | YES | system:view | probes+latency | Unit probes | BLOCKED deploy | CONNECTED |
| Math RO | YES | math-versions | YES | math:view | game_math_versions | Unit usage | BLOCKED deploy | CONNECTED |
| Admins / RBAC | YES | admins* + matrix | YES | admins:* | admin_users | Unit RBAC | BLOCKED deploy | CONNECTED |

\*Code CONNECTED locally; Production column means **current live build has not received this round’s deploy** (Push/Deploy forbidden without 赵总批准).

**COMPLETE rule:** Only rows with UI+API+Auth+RBAC wired and not money-gated count as COMPLETE for ops. Money modules remain PARTIAL by policy (GATE CLOSED).

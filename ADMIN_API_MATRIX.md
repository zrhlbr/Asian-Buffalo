# ADMIN_API_MATRIX

**Phase:** ADMIN-1A  
**Date:** 2026-08-09  
**Router:** `lib/admin/admin-api.ts` via `GET|POST /api/admin/[...slug]`  
**Auth:** All routes except `POST login` require `resolveAdminIdentity`  
**Version stamp:** `ADMIN_API_VERSION = r1-m9-admin-1.0.0`

Legend: **LIVE** = real handler+DB · **GATED** = exists but money/provider blocked · **RO** = read-only · **MISSING** = needed by ADMIN-1 but absent

---

## Auth

| Method | Path | Permission | Class | Notes |
|--------|------|------------|-------|-------|
| POST | `login` | none | LIVE | Sets `ab_admin` cookie + token body |
| POST | `logout` | `dashboard:view` | LIVE | Deletes session |
| GET | `me` | `dashboard:view` | LIVE | permissions included |

## Dashboard / Reports

| Method | Path | Permission | Class |
|--------|------|------------|-------|
| GET | `dashboard` | `dashboard:view` | LIVE RO |
| GET | `reports/ops` | `dashboard:view` | LIVE RO |

## Players / Sessions

| Method | Path | Permission | Class | Notes |
|--------|------|------------|-------|-------|
| GET | `players` | `players:view` | LIVE RO | page/search/status |
| GET | `players/:id` | `players:view` | LIVE RO | |
| POST | `players/:id/freeze` | `players:freeze` | LIVE | reason+audit |
| POST | `players/:id/unfreeze` | `players:freeze` | LIVE | |
| POST | `players/:id/close` | `players:freeze` | LIVE | login restrict |
| POST | `players/:id/reopen` | `players:freeze` | LIVE | |
| GET | `sessions` | `rounds:view` | LIVE RO | |
| GET | `sessions/:id` | `rounds:view` | LIVE RO | |
| POST | `sessions/:id/revoke` | `system:manage` | LIVE | should be finer perm later |

**MISSING (planned):** `players/:id/notes`, `players/:id/ban` (if separated), login-history dedicated, online filter API fields

## Games / Rounds / Spins / Math

| Method | Path | Permission | Class |
|--------|------|------------|-------|
| GET | `games` | `rounds:view` | LIVE RO |
| GET | `games/:id/ops` | `rounds:view` | LIVE RO |
| GET | `rounds` | `rounds:view` | LIVE RO |
| GET | `rounds/:id` | `rounds:view` | LIVE RO + ledger link |
| GET | `spins` | `rounds:view` | LIVE RO alias |
| GET | `spins/:id` | `rounds:view` | LIVE RO alias |
| GET | `math-versions` | `math:view` | LIVE RO |
| GET | `math-versions/:id` | `math:view` | LIVE RO |

**BLOCKED:** any math/RTP/RNG mutate endpoints (absent — correct)

## Wallet / Ledger

| Method | Path | Permission | Class |
|--------|------|------------|-------|
| GET | `wallet/intents` | `wallet:view` | LIVE RO |
| GET | `wallet/intents/:id` | `wallet:view` | LIVE RO |
| GET | `wallet/provider-ops` | `wallet:view` | LIVE RO |
| GET | `ledger/accounts` | `ledger:view` | LIVE RO |
| GET | `ledger/transactions` | `ledger:view` | LIVE RO |
| GET | `ledger/entries` | `ledger:view` | LIVE RO |
| GET | `ledger/balances` | `ledger:view` | LIVE RO |
| GET | `ledger/health` | `ledger:view` | LIVE RO |

**BLOCKED / MISSING:** `POST wallet/adjust` — do not add in 1B–1D without security phase

## Deposit / Withdraw

| Method | Path | Permission | Class | Notes |
|--------|------|------------|-------|-------|
| GET | `deposits` | `deposit:view` | LIVE RO | |
| GET | `deposits/config` | `deposit:view` | LIVE RO | |
| POST | `deposits/config` | `deposit:manage` | LIVE | reason+audit |
| POST | `deposits/:id/confirm` | `deposit:manage` | **GATED** | `PROVIDER_NOT_CONFIGURED` unless test identity |
| GET | `withdrawals` | `withdraw:view` | LIVE RO | |
| GET | `withdrawals/config` | `withdraw:view` | LIVE RO | |
| POST | `withdrawals/config` | `withdraw:review` | LIVE | |
| POST | `withdrawals/:id/approve` | `withdraw:review` | LIVE | MoneyService path |
| POST | `withdrawals/:id/reject` | `withdraw:review` | LIVE | |
| POST | `withdrawals/:id/pay` | `withdraw:pay` | LIVE | mark paid — still subject to REAL gate elsewhere |

## VIP / Activities

| Method | Path | Permission | Class |
|--------|------|------------|-------|
| GET | `vip/levels` | `vip:view` | LIVE |
| POST | `vip/levels` | `vip:manage` | LIVE | reason |
| GET | `vip/players/:id` | `vip:view` | LIVE |
| POST | `vip/players/:id` | `vip:manage` | LIVE | reason |
| GET | `activities` | `activity:view` | LIVE |
| POST | `activities` | `activity:manage` | LIVE | reason |

## Risk / System / Content / Logs / Admins

| Method | Path | Permission | Class | Notes |
|--------|------|------------|-------|-------|
| GET | `risk/signals` | `risk:view` | LIVE RO | computed |
| GET | `system/config` | `system:view` | LIVE | |
| POST | `system/config` | `system:manage` | LIVE | support_info etc. |
| GET | `system/announcements` | `system:view` | LIVE | |
| POST | `system/announcements` | `system:manage` | LIVE | locales zh/en/my for PUBLISHED |
| POST | `system/announcements/:id/publish` | `system:manage` | LIVE | **Gap:** no server-side zh/en/my re-validation |
| POST | `system/announcements/:id/unpublish` | `system:manage` | LIVE | |
| GET | `system/status` | `system:view` | LIVE | |
| GET | `logs/admin` | `logs:view` | LIVE | |
| GET | `logs/game` | `logs:view` | LIVE | |
| GET | `admins` | `admins:view` | LIVE | |
| GET | `admins/stats` | `admins:view` | LIVE | |
| GET | `admins/matrix` | `admins:view` | LIVE | |
| GET | `admins/:id/audit` | `admins:view` | LIVE | |
| POST | `admins` | `admins:manage` | LIVE | |
| POST | `admins/:id` | `admins:manage` | LIVE | disable/enable/role/password |

## Missing APIs for ADMIN-1 IA (not implemented)

| Needed | Suggested phase | Notes |
|--------|-----------------|-------|
| Risk event CRUD / disposition | 1E | persist + manage |
| Support tickets | 1G | OPEN→CLOSED |
| Banner CMS | 1F | trilingual |
| Content publish perm split | 1A→1F | RBAC rename/additive |
| Wallet Available/Frozen aggregate endpoint | 1D | RO |
| Pending deposit KPI | 1B | dashboard field |
| Today login KPI (auth events) | 1B | needs auth session data |
| Admin rate-limit middleware | 1H | login + mutate |
| Audit before/after/requestId | 1E | schema additive |
| Manual adjust | FUTURE | BLOCKED |

## DB write surface (Admin)

Allowed writes today:
- `admin_*` tables
- `players.status` (freeze/close)
- `game_sessions` revoke/status via revoke handler
- VIP/activity/deposit/withdraw commerce services (not raw balance UPDATE)
- Announcements/config

Forbidden by design:
- Raw wallet/ledger balance UPDATE
- Math/RTP/RNG mutation
- Bypassing provider gate in production

## Isolation

| Check | Result |
|-------|--------|
| Prefix `/api/admin` only in 西游戏 repo | YES |
| ZRHPay Admin/Accounts APIs | NOT wired |
| Cookie name | `ab_admin` product-local |

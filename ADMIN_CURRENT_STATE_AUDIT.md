# ADMIN_CURRENT_STATE_AUDIT

**Product:** 《西游戏》 / XI GAME · Bull Demon King  
**Target:** `https://www.xibull.com/admin`  
**Workspace:** `D:\Asian-Buffalo-R1-M9-Cursor-Clean`  
**Audit date:** 2026-08-08  
**Mode:** Read-only inventory before modification  
**Isolation:** 《西游戏》Admin ≠ ZRHPay Admin（独立 Session / Cookie / Admin 账号 / DB / API）

---

## 1. Entry & routes

| Surface | Path | Status | Notes |
|---------|------|--------|-------|
| Admin SPA | `/admin` | PARTIAL | Single page shell + in-app login |
| Dedicated login URL | `/admin/login` | MISSING | Spec requires `/admin/login`; only in-shell login exists |
| Admin API | `/api/admin/*` | PARTIAL | Catch-all → `lib/admin/admin-api.ts` (~56 routes) |
| Player game API | `/api/v1/game/*` | N/A | Out of admin scope; money fail-closed |

---

## 2. Menu / modules (UI)

| Module | Menu | Classification | Evidence |
|--------|------|----------------|----------|
| Dashboard | Yes | PARTIAL | Real `GET dashboard`; UI expects `byCurrency` / sparkline keys missing in API+i18n |
| Players | Yes | PARTIAL | List/detail/freeze wired; device often empty; no login-restrict action |
| VIP | Yes | PARTIAL | Levels + assign; level upsert UI unused; BR pending banner |
| Activities | Yes | PARTIAL | List/upsert; crude form; rewards via MoneyService on claim (not admin credit) |
| Sessions | Yes | PARTIAL | RO list/detail; force-revoke missing; deep-link props dropped |
| Rounds | Yes | PARTIAL | RO; deep-link props dropped |
| Spins | Yes | PARTIAL | Alias of rounds; RO; deep-link props dropped |
| Risk | Yes | PARTIAL | Signals RO; missing HIGH_FREQ / honest multi-device vs tests |
| Reports / Rankings lite | Yes | PARTIAL | Ops report; DAU/MAU/retention/rankings fields missing vs tests |
| Wallet | Yes | BROKEN | List OK; `GET wallet/intents/:id` **404** |
| Deposits | Yes | PARTIAL | List + confirm (harness-only → `PROVIDER_NOT_CONFIGURED`) |
| Withdrawals | Yes | PARTIAL | Approve/reject/pay wired; production money remains TEST/fail-closed |
| Ledger | Yes | PARTIAL | RO + health; `kind=` filter incomplete vs tests |
| Math | Yes | PARTIAL | RO; usage counts missing vs tests |
| System | Yes | PARTIAL | Config/status/logs/announcements; ann draft/locales mismatch |
| Admins | Yes | COMPLETE | Create/disable/role/password + matrix + audit |
| Game Management | No | MISSING | No first-class nav |
| 牛魔王 Ops | No | MISSING | Branding only |
| Announcements (dedicated) | Nested | PARTIAL | Under System; create ignores draft/locales |
| Rankings (dedicated) | Nested | PARTIAL | Under Reports only |
| Customer Service | No | MISSING | Only `support_info` config JSON |
| Audit Log (dedicated) | Nested | PARTIAL | System → Logs; `logs/game` unused in UI |

**Shell defect (BROKEN):** `ModuleView` ignores `tab.props` → all cross-module deep links dead.

---

## 3. API inventory summary

| Area | Endpoints | Auth/RBAC | Classification |
|------|-----------|-----------|----------------|
| Auth | login / logout / me | Session `ab_admin` | COMPLETE |
| Dashboard | GET dashboard | `dashboard:view` | PARTIAL (missing analytics fields) |
| Players | list/detail/freeze/unfreeze | players:* | PARTIAL (no login-restrict) |
| Sessions | list/detail | `rounds:view` | PARTIAL (no revoke) |
| Rounds/Spins | list/detail | `rounds:view` | COMPLETE (RO alias) |
| Wallet | intents, provider-ops | `wallet:view` | BROKEN (no intent detail) |
| Ledger | accounts/tx/entries/balances/health | `ledger:view` | PARTIAL |
| Deposit/Withdraw | list/config/confirm/review/pay | deposit/withdraw:* | PARTIAL + MONEY GATE |
| VIP / Activities | levels/players/activities | vip/activity:* | PARTIAL |
| Math | versions RO | `math:view` | PARTIAL |
| Risk | signals | `risk:view` | PARTIAL |
| System | config/announcements/status | system:* | PARTIAL |
| Logs | admin / game | `logs:view` | PARTIAL (UI incomplete) |
| Admins | CRUD-ish + matrix | admins:* | COMPLETE |
| Games / Rankings / CS | — | — | MISSING |

Mutations require `reason` + `admin_audit_logs` (except login path).  
**Money invariant:** no raw UPDATE on wallet/ledger/math balances.

---

## 4. RBAC

| Role | Mapped intent | Backend enforced? |
|------|---------------|-------------------|
| SUPER_ADMIN | All | YES |
| OPS | Ops + freeze + deposit manage + withdraw review + activity | YES |
| FINANCE | Wallet/ledger/deposit/withdraw(+pay) | YES |
| SUPPORT / Customer Service | View players/sessions/commerce | YES (`SUPPORT`) |
| RISK | Risk + freeze + withdraw review | YES |
| AUDIT / READONLY | All views | YES |
| TECH | System/math/logs/activity | YES |

Frontend menu is **not** permission-filtered per role (UI shows full nav; API denies).  
→ Treat as PARTIAL for “least privilege UX”; backend is real (not UI-only hide).

---

## 5. Database (admin-related)

| Table group | Present | Notes |
|-------------|---------|-------|
| `admin_users` / `admin_sessions` / `admin_audit_logs` | YES | Sidecar bootstrap |
| `admin_announcements` / `admin_system_config` | YES | Sidecar |
| `players` / `game_sessions` / `game_rounds` | YES | Core |
| `ledger_*` / `wallet_*` | YES | Core money |
| `player_vip` / deposit / withdrawal / activities | YES | Commerce sidecars |
| `player_auth_sessions` | REFERENCED | No CREATE in repo → IP/device often null |
| Rankings table | NO | Computed from `game_rounds` only |
| Dedicated spins table | NO | Spins = rounds alias |

Player status enum: `ACTIVE` | `LOCKED` | `CLOSED`.

---

## 6. Tests

| Suite | Status |
|-------|--------|
| `tests/r1-m7-admin.test.mjs` | Expects M9 analytics/announcement/risk/wallet-detail — **code drift**; also needs `better-sqlite3` installed to run |
| `tests/r1-m7-commercial.test.mjs` | Static presence checks |
| Deposit/VIP/Withdraw admin HTTP | MISSING dedicated suite |

Docs `docs/m9-admin/PROGRESS.md` claims 19/19 PASS — **not reflected by current source**.

---

## 7. Production deployment (observed at audit time)

| Check | Status |
|-------|--------|
| Domain `www.xibull.com` | Deployed product site (prior M8/M9) |
| `/admin` | Exists as SPA route in this codebase |
| Production money | **GATE CLOSED** — REAL money fail-closed; deposit confirm returns `PROVIDER_NOT_CONFIGURED` without test identity |
| Live E2E this audit | Pending post-fix verification section |

---

## 8. Classification legend used

| Tag | Meaning |
|-----|---------|
| COMPLETE | UI + API + Auth + RBAC + DB wired for primary ops |
| PARTIAL | Real wiring with material gaps |
| UI_ONLY | Page without API |
| API_ONLY | API without admin page |
| STUB | Placeholder |
| BROKEN | Wired but returns 404/500 or props ignored |
| MISSING | Required product surface absent |

---

## 9. Priority fix list (implementation order)

1. **P0** — Restore test/API contract: dashboard fields, wallet intent detail, ops report, risk tags, math usage, announcement draft/locales, ledger kind filter, system probes  
2. **P0** — Fix `ModuleView` tab props + i18n missing keys  
3. **P0** — Money safety unchanged: no balance UPDATE; deposit confirm stays gated  
4. **P1** — `/admin/login`, session revoke, player CLOSE/reopen, Game + 牛魔王 ops, Announcement/Ranking/CS/Audit nav, 7-day dashboard  
5. **P1** — Production smoke + delivery reports  

---

## 10. Isolation proof (audit)

| Concern | Finding |
|---------|---------|
| ZRHPay brand/SDK in admin | Not found under `app/admin` / `lib/admin` |
| Shared admin cookie with ZRHPay | Cookie `ab_admin` — product-local |
| Shared DB with Payment/Accounts | Not used; local D1/sqlite game DB |
| Cross-product API prefix coupling | `/api/admin` is 西游戏-local |

**Verdict before changes:** Admin is a real ops console with substantial PARTIAL/BROKEN/MISSING gaps — **not** production-complete for the full checklist in the task brief.

---

## 11. Post-fix note (same day)

Local implementation closed the P0 API/UI drifts listed in §9.  
`tests/r1-m7-admin.test.mjs` → **19/19 PASS**.  
Production deploy of this round was **not** performed. See `FINAL_ADMIN_VERDICT.md`.

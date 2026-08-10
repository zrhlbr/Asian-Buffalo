# ADMIN_CURRENT_STATE_AUDIT_V2

**Product:** 《西游戏 / XI GAME》· 牛魔王 (Bull Demon King)  
**Workspace:** `D:\Asian-Buffalo-R1-M9-Cursor-Clean`  
**Baseline HEAD:** `9654d4194d2db801467af34cef1ddc5650fd310f`（detached; Admin 改动多为 worktree 未提交）  
**Phase:** ADMIN-1A（只读审计）  
**Audit date:** 2026-08-09  
**Mode:** Read-only · 不改 Production 数据 · 不开真实资金 · 不 Push/Merge/Rebase  

**Isolation:** 《西游戏》Admin ≠ ZRHPay Admin（独立 Cookie `ab_admin` / `admin_users` / D1 游戏库 / `/api/admin`）

---

## 0. Legend

| Tag | Meaning |
|-----|---------|
| **IMPLEMENTED** | UI + API + Auth + RBAC + DB 已接通，可运营主路径可用 |
| **PARTIAL** | 真实接线，但相对 ADMIN-1 正式后台清单仍有实质缺口 |
| **MISSING** | 产品面缺失或仅占位 |
| **BLOCKED** | 有意冻结（资金门 / 安全阶段），本阶段不得补齐写能力 |
| **UI_ONLY** | 有页面无真实 API |
| **API_ONLY** | 有 API 无完整管理页 |

---

## 1. Entry & shell

| Surface | Path | Status | Evidence |
|---------|------|--------|----------|
| Admin SPA | `/admin` | IMPLEMENTED | `app/admin/page.tsx` → `admin-app.tsx` |
| Admin Login URL | `/admin/login` | IMPLEMENTED | `app/admin/login/page.tsx`（同壳 LoginScreen） |
| In-shell login | LoginScreen | IMPLEMENTED | `admin-app.tsx` |
| Admin API | `/api/admin/*` | IMPLEMENTED | `app/api/admin/[...slug]/route.ts` → `lib/admin/admin-api.ts` |
| Nav RBAC filter | sidebar | IMPLEMENTED | `can(permission)` 过滤菜单；API 仍二次校验 |
| Deep-link tab props | ModuleView | IMPLEMENTED | `initialProps` / `tab.props` 已接线（相对 V1 已修） |
| Visual theme | dark ops | PARTIAL | 深色后台；仍含娱乐化 emoji 图标，非赌场大红主题 |

---

## 2. Module matrix (current vs ADMIN-1 IA)

| IA Area | Module (nav) | UI | API | Data | Classification |
|---------|--------------|----|-----|------|----------------|
| 运营总览 | Dashboard | Yes | `GET dashboard` | Real SQL aggregates | **PARTIAL** |
| 运营总览 | Reports | Yes | `GET reports/ops` | Real | **PARTIAL** |
| 玩家管理 | Players | Yes | list/detail/freeze/unfreeze/close/reopen | Real + sidecars | **PARTIAL** |
| 玩家管理 | Sessions | Yes | list/detail/revoke | Real | **PARTIAL** |
| 游戏管理 | Games | Yes | `GET games` | Hardcoded official game + live counts | **PARTIAL** |
| 游戏管理 | Game Ops (牛魔王) | Yes | `GET games/:id/ops` | Real aggregates RO | **PARTIAL** |
| 游戏管理 | Math | Yes | math-versions RO | Real | **IMPLEMENTED** (RO only — correct for phase) |
| 订单/局 | Rounds / Spins | Yes | list/detail (+ spins alias) | Real + ledger link | **PARTIAL** |
| 钱包中心 | Wallet / Ledger | Yes | intents/detail/provider-ops + ledger* | Real | **PARTIAL** |
| 钱包中心 | Deposits / Withdrawals | Yes | list/config/review/pay/confirm | Real + **GATE** | **PARTIAL** + **BLOCKED** (live money) |
| 风控中心 | Risk | Yes | `GET risk/signals` | Computed RO (no disposition) | **PARTIAL** |
| 活动运营 | Activities / VIP | Yes | activities + vip APIs | Real sidecars | **PARTIAL** |
| 内容管理 | Announcements | Yes | system/announcements* | Real | **PARTIAL** |
| 内容管理 | Banner CMS | No | — | — | **MISSING** |
| 客服中心 | Support | Yes | `system/config` support_info only | Config JSON | **PARTIAL** → tickets **MISSING** |
| 审计中心 | Audit | Yes | logs/admin (+ game) | Real | **PARTIAL** |
| 系统中心 | System / Admins | Yes | config/status/admins* | Real | **PARTIAL** / Admins **IMPLEMENTED** |
| 排行 | Rankings | Yes | via reports/ops | Computed from rounds | **PARTIAL** |

**No UI-only fake dashboards found for core modules.** Empty → `0` / empty table / `Not Configured` patterns present in Support & Games version.

---

## 3. Auth / Session

| Item | Status | Notes |
|------|--------|-------|
| Admin Login | IMPLEMENTED | `POST login` username/password |
| Admin Session | IMPLEMENTED | Opaque token in `admin_sessions`; cookie `ab_admin` HttpOnly |
| Session TTL | IMPLEMENTED | 12h |
| Logout | IMPLEMENTED | Deletes session + audit |
| `GET me` | IMPLEMENTED | Returns role + permissions |
| Separation from player identity | IMPLEMENTED | `lib/identity.ts` ≠ `lib/admin/admin-auth.ts` |
| Bootstrap | IMPLEMENTED (fail-closed) | Needs `AB_ADMIN_BOOTSTRAP_PASSWORD` or test identity |
| Password algo | PARTIAL | Iterated salted SHA-256 (100k); not argon2/scrypt |
| Login rate limit | MISSING | No throttle / lockout on `/api/admin/login` |
| Admin Login Log (dedicated) | PARTIAL | `admin.login` in audit_logs, not separate security log |

---

## 4. RBAC

| Item | Status |
|------|--------|
| Roles table | IMPLEMENTED: SUPER_ADMIN, OPS, SUPPORT, FINANCE, RISK, AUDIT, TECH, READONLY |
| CONTENT role | MISSING (ops via `system:manage`) |
| CUSTOMER_SERVICE role name | PARTIAL (`SUPPORT` maps intent) |
| Permission list | PARTIAL vs ADMIN-1 spec (colon style `players:freeze` vs `players.freeze`) |
| API enforcement | IMPLEMENTED (`roleHasPermission` every route except login) |
| UI button hide | IMPLEMENTED (`can`) — **not** sole control |
| Dangerous ops reason | IMPLEMENTED (`requireReason`) |
| Fine perms (ban / session.revoke / content.publish / risk.manage / wallet.adjust / support.*) | MISSING or remapped |

详见 `ADMIN_RBAC_MATRIX.md`。

---

## 5. Dashboard (ops KPIs)

| Required KPI | Present? | Source / note |
|--------------|----------|---------------|
| 今日新增玩家 | YES | `players` date=today |
| 总玩家数 | YES | `COUNT(players)` |
| 当前在线 | YES | OPEN `game_sessions` not expired |
| 今日登录玩家 | PARTIAL | Uses **今日有局玩家** (`game_rounds` DISTINCT)，非登录事件 |
| 今日游戏人数 | YES | same as todayActive |
| 今日局数 | YES | `spinCount` |
| 今日投注/派彩/净结果 | YES | settled rounds |
| 今日充值/提现 | YES | order/request counts (not amounts on cards) |
| 待处理充值 | MISSING as KPI | withdraw pending exists; deposit pending not on dashboard |
| 待处理提现 | YES | PENDING/UNDER_REVIEW/APPROVED/PAYING |
| 风险事件 | PARTIAL | `anomalyCount` = stuck rounds + wallet issues；非完整 risk feed |
| 系统告警 | PARTIAL | `api.ok` / `system.ok` hardcoded `true` |
| 24h 趋势 | YES | `hourly` real aggregate |
| 7日趋势 | YES | `trend7d` real spine + aggregates |
| Fake pretty numbers | NO | Zero when empty; no mock series |

**Verdict: PARTIAL** — 可运营基础已有，KPI 口径与告警诚实度未达 ADMIN-1 全文。

---

## 6. Players

| Capability | Status |
|------------|--------|
| List + pagination | IMPLEMENTED |
| Search UID / wallet ref / nickname | PARTIAL（手机脱敏列有；邮箱搜索 MISSING） |
| Filter ACTIVE/LOCKED/CLOSED | IMPLEMENTED |
| Filter risk / online | MISSING |
| Detail: profile/VIP/phone mask/sessions/rounds/wallet/ledger/risk tags | PARTIAL |
| Login history / device / IP history | PARTIAL — `player_auth_sessions` 可选；常空 → 诚实 `noDeviceData` |
| Freeze / Unfreeze | IMPLEMENTED + reason + confirm + audit |
| Close / Reopen (login restrict) | IMPLEMENTED（作封禁近似；非独立 BAN 权限） |
| Force revoke session | IMPLEMENTED on Sessions (`system:manage`) |
| Admin notes | MISSING |
| Balance Available/Frozen on player | PARTIAL — ledger accounts 列表；无统一 Wallet Center 字段语义 |
| Fake balance edit | BLOCKED by design — UI banner forbids |

**Verdict: PARTIAL**

---

## 7. Games / Round / Spin

| Capability | Status |
|------------|--------|
| Games list (牛魔王 + future reserve) | PARTIAL — 单游戏常量 `bull-demon-king` + 今日聚合；未来游戏仅预留结构 |
| Game toggle / version field | MISSING / NOT CONFIGURED |
| 牛魔王 ops RO | PARTIAL — today spins/players/bet/win/free + jackpot string counts |
| Math / RTP / Paytable edit | BLOCKED — Math 模块只读（正确） |
| Round/Spin query by id/player/session/status | IMPLEMENTED |
| Round detail ↔ ledger/wallet | IMPLEMENTED (`ledgerTx`, `walletIntent`, derived `balanceBefore`) |
| Game ID filter on rounds | MISSING（单游戏隐含） |
| Time range filter UI | PARTIAL |

**Verdict: PARTIAL**（追踪链存在；运营观测面未完成）

---

## 8. Wallet / Ledger / Money

| Capability | Status |
|------------|--------|
| Wallet intents list/detail | IMPLEMENTED |
| Provider ops | IMPLEMENTED |
| Ledger accounts/tx/entries/balances/health | IMPLEMENTED |
| Deposit orders admin | PARTIAL |
| Withdraw review/pay | PARTIAL |
| Manual adjust (加/扣款) | **BLOCKED / FUTURE** — 无 `wallet:adjust`；禁止 raw UPDATE |
| Balance / Available / Frozen 语义 UI | PARTIAL（ledger `PLAYER_AVAILABLE` 等 kind） |
| Live deposit confirm | **BLOCKED** → `PROVIDER_NOT_CONFIGURED` unless test identity |
| REAL money | **GATE CLOSED** (`allowRealMoney=false`, math `realMoneyEnabled=false`) |

**Verdict: PARTIAL + MONEY GATE CLOSED**

---

## 9. Risk

| Capability | Status |
|------------|--------|
| Signal computation | PARTIAL — ABNORMAL_BET/WIN, DUPLICATE_*, PROVIDER_TIMEOUT, MATH_MISMATCH, HIGH_FREQ_SPIN, ABNORMAL_BALANCE, etc. |
| MULTI_DEVICE | Honest **MULTI_DEVICE_UNAVAILABLE** (not faked) |
| Persist risk events / workflow | MISSING |
| risk.manage / notes / RESOLVED | MISSING |
| Levels LOW..CRITICAL | IMPLEMENTED on computed signals |

**Verdict: PARTIAL**

---

## 10. Content / Activity / VIP / CS

| Area | Status |
|------|--------|
| Announcements zh/en/my | PARTIAL — `POST system/announcements` 在 status=PUBLISHED 时强制 zh/en/my；draft 可不完全；**`publish` 状态切换路径未在服务端二次校验三语**（UI 有校验，API 缺口） |
| Banner | MISSING |
| Activities (含签到归属 Activity Center) | PARTIAL |
| VIP levels + assign | PARTIAL（只读权益配置为主；仍有 manage API） |
| Customer tickets | MISSING — Support = channel config only |

---

## 11. Audit / Security

| Item | Status |
|------|--------|
| admin_audit_logs | PARTIAL — operator/action/target/reason/ip/detail_json/time；缺 structured Before/After、Request ID、Role 列 |
| Game audit events | PARTIAL — API 有；UI Audit 模块覆盖情况见功能矩阵 |
| Rate limit | MISSING |
| Secrets not returned | IMPLEMENTED in status payloads (policy) |
| Player token → Admin API | Blocked by admin session requirement |

---

## 12. DB boundary

| Group | Present | Boundary |
|-------|---------|----------|
| `admin_*` sidecars | YES | Admin-only bootstrap IF NOT EXISTS |
| Core game/money | YES | players / sessions / rounds / ledger / wallet |
| Commerce sidecars | YES | VIP / deposit / withdrawal / activities |
| `player_auth_sessions` | REFERENCED | CREATE 不在本仓主迁移 → IP/device 常空 |
| ZRHPay / Accounts DB | NOT USED | Isolation preserved |

---

## 13. Mock / Fake / Placeholder inventory

| Finding | Classification |
|---------|----------------|
| Dashboard / trend aggregates | Real SQL — not mock |
| Games catalog row | Product constant (official title) + real counters — not fake money |
| Risk MULTI_DEVICE_UNAVAILABLE | Honest placeholder signal |
| Support empty channels | `Not Configured` |
| Games.version empty | `Not Configured` |
| `api.ok` / `system.ok` always true | Honesty gap (over-green) |
| Activity reward “placeholder” i18n copy | Product copy; claims go MoneyService |
| Client `mock-provider` under `client/m5` | Player game test path — **out of Admin scope**; not Admin dashboard fake data |

---

## 14. Prior V1 delta (2026-08-08 → V2)

Closed in local worktree (still largely uncommitted): `/admin/login`, ModuleView props, wallet intent detail, dashboard 7d, games/gameOps/announcements/rankings/support/audit nav, session revoke, player close, permissions on me, many API contract drifts.  

Still open for ADMIN-1: fine RBAC, risk workflow, CS tickets, banner, wallet adjust (blocked), auth session table, pending-deposit KPI, rate limit, audit Before/After, production deploy.

---

## 15. Phase ADMIN-1A audit conclusion

| Question | Answer |
|----------|--------|
| Is M9 Admin a rewrite candidate? | **NO** — evolve in place |
| Is Admin only decorative UI? | **NO** — real API+DB for core ops |
| Is Admin production-complete vs ADMIN-1 IA? | **NO** — many PARTIAL/MISSING |
| Money gate | **CLOSED** |
| Isolation vs ZRHPay | **HELD** |
| Safe to plan ADMIN-1B? | **YES** |

**ADMIN CURRENT STATE AUDIT process: PASS**（完整只读盘点完成；非“功能已全部就绪”）

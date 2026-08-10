# ADMIN_PRODUCTION_PUBLIC_E2E

**Date (UTC):** 2026-08-10  
**Base:** https://www.xibull.com  

---

## Public routes（curl + browser UA）

| URL | HTTP | Notes |
|---|---|---|
| `/` | 200 | Lobby entry |
| `/xi` | 200 | Lobby |
| `/xi/login` | 200 | Player login |
| `/xi/register` | 200 | Player register |
| `/xi/bull-demon-king` | 200 | Hub |
| `/xi/bull-demon-king/play` | 200 | Play |
| `/admin` | 200 | Admin shell |
| `/admin/login` | 200 | Admin login |
| `/api/admin/me`（无 Token） | **401** | Auth fail-closed |

玩家端未因 Admin 上线中断。

---

## Admin Auth

| Check | Result |
|---|---|
| `/admin/login` → 200 | PASS |
| 无 Token `/api/admin/me` → 401 | PASS |
| 错误密码 → 401 `LOGIN_FAILED` | PASS |
| Bootstrap 管理员登录（本机回环，不打印 Secret） | PASS → 200 + session |
| Auth 未关闭 | PASS |

> 说明：服务器经公网 POST 可能被 Cloudflare `1010` 拦截；认证写操作以 `127.0.0.1:18130` 回环验证，公网页面以 GET 200 验证可达。

---

## Authenticated module smoke（loopback → same prod image）

| Area | Endpoint sample | Result |
|---|---|---|
| Dashboard | `/api/admin/dashboard` | 200；真实 metrics source；无 mock 标记 |
| Players | `/api/admin/players` | 200（email 列修复后） |
| Games | `/api/admin/games` | 200 |
| Rounds / Spins | `/api/admin/rounds` `/spins` | 200 |
| Wallet | `/api/admin/wallet/balances` `/wallet/integrity` | 200；frozenMinor 来源明确 |
| Money gate | `/api/admin/money/gate` | CLOSED |
| Ledger | `/api/admin/ledger/transactions` `/ledger/health` | 200 |
| Deposit / Withdraw list | `/deposits` `/withdrawals` | 200 |
| Risk | `/risk/overview` `/risk/events` | 200 |
| Audit（只读） | `/logs/admin` | 200 |
| Content | banners / recommended-games / announcements | 200 |
| Activity / VIP | `/activities` `/vip/levels` | 200 |
| Support tickets | `/support/tickets` | 200 |
| Admin users / roles | `/admins` `/admins/roles` | 200；`editable=false` |
| Sessions / Security | `/sessions` `/security/overview` | 200 |

API fail count（正确路径复测）：**0**

---

## Money fail-closed（公网生产行为）

| Action | Result |
|---|---|
| Deposit confirm | `503 PROVIDER_NOT_CONFIGURED` |
| Withdrawal pay | `503 PROVIDER_NOT_CONFIGURED` / GATE CLOSED |
| 真实资金意外成功 | **未发生** |

---

## S-18 / Content

| Check | Result |
|---|---|
| Publish incomplete locales | `400 CONTENT_I18N_INCOMPLETE` |
| S-18 | **CLOSED** |
| PLAYER CONTENT SYNC | **PARTIAL** |

---

## Screenshots

本会话 browser MCP 不可用（仅 `cursor-app-control`）。公网页面以 HTTP 200 + body size 作为可达证据；UI 截图需赵总本机浏览器补拍或后续有 browser 工具时补档。

建议补拍：Admin Login / Dashboard / Players / Games / Wallet / Risk / Audit / Content / Support / Admin Users / Security × 1440 + 390。

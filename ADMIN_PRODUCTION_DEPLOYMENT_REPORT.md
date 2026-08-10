# ADMIN_PRODUCTION_DEPLOYMENT_REPORT

**Date (UTC):** 2026-08-10  
**Target:** https://www.xibull.com/admin  
**Scope:** ADMIN-1B ～ ADMIN-1G Current Admin Production Deployment  
**Not in scope:** PRODUCTION MONEY ENABLEMENT；ADMIN-1H 最终总收口  

---

## Verdict (summary)

| Item | Result |
|---|---|
| PRODUCTION DEPLOYED | **YES** |
| XI GAME ADMIN PRODUCTION | **PASS**（1B～1G；1H 未宣称 PASS） |
| XI GAME PLAYER PRODUCTION | **PASS**（公网玩家路由未因本次部署中断） |
| PRODUCTION MONEY | **NO / GATE CLOSED** |
| ROLLBACK READY | **YES** |
| ADMIN-1H | **未完成 / 不得伪造 PASS** |

---

## Pre-deploy snapshot

| Field | Value |
|---|---|
| hostname | `zrh-server` |
| PREVIOUS_PRODUCTION_IMAGE | `sha256:dc0884cd294768cba33a33201e131edf3594f828bc0a07f5f97c026f2647db55` |
| Previous container | `941981fe6334`（healthy） |
| Rollback tag | `xigame-web:prod-pre-admin-20260809-232936` |
| Compose | `/home/zrh-admin/xigame-prod/app/deploy/production/docker-compose.yml` |
| ENV structure | `/home/zrh-admin/xigame-prod/env/production.env`（mode 600；**未写入任何 Secret 值**） |
| ZRHPay / Accounts | 部署前后均保持运行，未修改 |

---

## Deployment source identity（诚实 dirty tree）

| Field | Value |
|---|---|
| Workspace | `D:\Asian-Buffalo-R1-M9-Cursor-Clean` |
| HEAD | `9654d4194d2db801467af34cef1ddc5650fd310f` |
| Branch | detached `HEAD` |
| Dirty file count（当时） | **470**（**不是** clean Git release） |
| Candidate identity | dirty-tree allowlist pack（ADMIN-1B～1G）叠加生产已有玩家端代码 |
| Commit / Push / Merge / Rebase | **NO** |

### Packaged allowlist（进入生产）

- `app/admin/**`（含 login + 1B～1G modules）
- `app/api/admin/[...slug]/route.ts`
- `app/api/v1/game/{announcements,banners,recommended-games}/route.ts`
- `lib/admin/**`
- `lib/player-content.ts`（首轮 Build 缺依赖后补齐）
- `lib/player-commerce-bootstrap.ts`（Players `email` 加性 ALTER）

### Explicitly NOT packaged

- 报告 / 截图 / 测试垃圾 / `.dev.vars` / 本地 secret
- `lib/runtime-identity.ts`（保留生产 `PlayerSessionIdentityProvider`，避免破坏玩家 Session）
- deposit/withdrawal/wallet-mode 等资金核心覆盖（沿用生产已有实现）
- RNG / RTP / Math / Paytable / Spin core

---

## Build / Switch

| Step | Result |
|---|---|
| 首轮 Build | FAIL：缺 `lib/player-content.ts` → **停止切换**（旧镜像继续 healthy） |
| 补齐后 Build | **PASS** |
| Candidate health | **healthy** |
| Switch production | **YES** |
| Nginx host reload | 未改 host vhost（`/admin` 既有路由）；container nginx **healthy** |

### Production image identity（当前）

| Field | Value |
|---|---|
| Production Image SHA | `sha256:fabe8fc2457c3162985cc27350a93d321b0a8ce3b8de5e867ae0e2e2f3b02b8c` |
| Short ID | `fabe8fc2457c` |
| Container ID | `15e81f18d2fc3a27ce1045a39861b1993235fad6756a0aeec1b2299ea74434f1` |
| Created | `2026-08-10T12:53:25Z` |
| Health | **healthy** |
| Source HEAD | `9654d4194d2db801467af34cef1ddc5650fd310f`（dirty allowlist） |

---

## DB migration

| Field | Value |
|---|---|
| DB MIGRATION REQUIRED | **YES**（运行时加性） |
| Kind | `CREATE TABLE IF NOT EXISTS`（admin sidecar）+ `ALTER TABLE player_profiles ADD COLUMN email`（若不存在） |
| DROP / TRUNCATE / 清玩家 / 清 Wallet / Ledger / Audit / Ticket | **NO** |
| Destructive migration executed | **NO** |

---

## Money gate（部署后实测）

| Check | Result |
|---|---|
| `GET /api/admin/money/gate` | `gate=CLOSED`, `productionMoney=false`, `walletAdjust=BLOCKED`, `testHarnessEnabled=false` |
| Deposit confirm | `503 PROVIDER_NOT_CONFIGURED` |
| Withdrawal pay | `503 PROVIDER_NOT_CONFIGURED` + `PRODUCTION MONEY GATE CLOSED` |
| AB_FORCE_FAIL_CLOSED_IDENTITY | 仍为 compose `1`（未关闭 Auth / 未开资金） |

---

## Core / isolation proofs

| Item | Result |
|---|---|
| RNG MODIFIED | **NO** |
| RTP MODIFIED | **NO** |
| MATH MODIFIED | **NO** |
| PAYTABLE MODIFIED | **NO** |
| SPIN CORE MODIFIED | **NO** |
| PRODUCT ISOLATION | **PASS**（西游戏独立栈；未改 ZRHPay / Accounts） |
| S-18 | **CLOSED**（publish → `CONTENT_I18N_INCOMPLETE`） |
| PLAYER CONTENT SYNC | **PARTIAL**（API 已上；Lobby 硬编码未在本次大改） |
| WALLET FROZENMINOR | **YES**（frozen = open withdrawal holds；total = available + frozen；unit=minor） |

---

## Local regression（生产候选，重新执行）

| Suite | Result |
|---|---|
| ADMIN-1B～1G `node --test` | **42/42 PASS**（不可仅引用旧报告） |

---

## Residual notes

1. 公网 Cloudflare 对服务器侧部分自动化 UA/POST 可能返回 1010/403；浏览器 UA 的公网 GET 与本机回环认证 E2E 已覆盖。  
2. S-18 探测在生产留下 DRAFT banner（`probe` / `probe2`）——非发布态；建议后续人工清理。  
3. Git dirty tree **未** 一次性 Commit；部署成功后单独收口。  

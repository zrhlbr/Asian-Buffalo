# ADMIN_PRODUCTION_SECURITY_REPORT

**Date (UTC):** 2026-08-10  

## Auth

| Check | Result |
|---|---|
| Admin login page public | 200 |
| Unauthenticated `/api/admin/me` | 401 |
| Wrong password | 401 |
| Session required for admin APIs | YES |
| Auth disabled for smoke | **NO** |

## Secrets

| Rule | Status |
|---|---|
| `AB_ADMIN_BOOTSTRAP_PASSWORD` 未写入 Git / 报告 / 截图 | **遵守** |
| 仅从 Production ENV 读取用于本机回环登录验证 | YES |
| 前端 Bundle 未嵌入 bootstrap secret | YES（未改打包 secret 路径） |

## Money / privilege

| Control | Status |
|---|---|
| PRODUCTION MONEY GATE | CLOSED |
| Wallet Adjust | BLOCKED |
| Test harness identity | disabled（`AB_FORCE_FAIL_CLOSED_IDENTITY=1`） |
| Deposit/Withdraw live provider | NOT_CONFIGURED → fail-closed |
| Roles matrix editable | `false`（静态 ROLE_PERMISSIONS） |
| Support money write | FORBIDDEN（代码门禁保持） |

## Product isolation

| Item | Result |
|---|---|
| 共享登录 / Session / DB | **NO** |
| ZRHPay SDK / Integration Center | **未植入** |
| 跨库直连 Payment/Account DB | **NO** |

## Residual risk

- Cloudflare 对部分自动化公网 POST 返回 1010：属边缘防护，不构成 Auth 关闭。  
- 生产探测留下 DRAFT content banners（非 PUBLISHED）。  

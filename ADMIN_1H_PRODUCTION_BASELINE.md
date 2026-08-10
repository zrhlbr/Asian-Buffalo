# ADMIN_1H_PRODUCTION_BASELINE

**Date (UTC):** 2026-08-10T13:42:02Z  
**Mode:** Read-only Production Truth Audit（先检查，未先改代码）  

## Production identity

| Field | Value |
|---|---|
| hostname | `zrh-server` |
| Public site | https://www.xibull.com |
| Admin | https://www.xibull.com/admin |
| Production Image SHA | `sha256:fabe8fc2457c3162985cc27350a93d321b0a8ce3b8de5e867ae0e2e2f3b02b8c` |
| Container ID | `15e81f18d2fc…` |
| Health | **healthy** |
| xigame-nginx | **healthy** (`749816acad85`) |
| Rollback tag | `xigame-web:prod-pre-admin-20260809-232936` → `sha256:dc0884cd2947…` **仍存在** |

## Isolation peers（未改）

| Name | Status |
|---|---|
| zrhpay-production-web | Up |
| zrh-stage27-prod-web / api / db / redis | healthy |

## ENV keys present（无 Secret 值）

`AB_ADMIN_BOOTSTRAP_PASSWORD`, `AB_FORCE_FAIL_CLOSED_IDENTITY`, `AB_SQLITE_PATH`, `HOSTNAME`, `NODE_ENV`, `PORT`

## Public / local smoke

| Probe | Result |
|---|---|
| local `/xi` `/admin` `/admin/login` | 200 |
| pub `/` `/xi` `/xi/login` `/xi/register` `/xi/bull-demon-king` `/play` | 200 |
| pub `/admin` `/admin/login` | 200 |
| pub `/api/admin/me`（无 Token） | **401** |

## Public bundle identity（sample）

Admin: `/assets/admin-app-QBxo4bCA.js`, `framework-CXnKph_e.js`, …  
Lobby: `/assets/lobby-app-28xlOUcJ.js`, `play-shell-KDepGbFF.js`, …

## Source workspace truth

| Field | Value |
|---|---|
| Workspace | `D:\Asian-Buffalo-R1-M9-Cursor-Clean` |
| HEAD | `9654d4194d2db801467af34cef1ddc5650fd310f` |
| Branch | detached HEAD |
| Dirty count | **478**（**不是** clean release） |
| Dominant dirty | docs(223), client/m5(44), app(40), lib(32), tests(16), ADMIN_* reports |

## Known gap entering 1H

| Gap | Status |
|---|---|
| PLAYER CONTENT SYNC | **PARTIAL**（Lobby Banner/Recommended 仍硬编码；见 Content Sync 报告） |
| Dirty tree allowlist deploy | 生产可运行，但不可复现为单一 SOURCE COMMIT |
| ADMIN-1H | 本轮收口目标 |

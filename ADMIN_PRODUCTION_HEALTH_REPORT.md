# ADMIN_PRODUCTION_HEALTH_REPORT

**Date (UTC):** 2026-08-10  

## Containers

| Name | Image | Status |
|---|---|---|
| xigame-web | `xigame-web:prod` (`sha256:fabe8fc2457c…`) | **Up / healthy** |
| xigame-nginx | `nginx:1.27-alpine` | **Up / healthy** |

## Local health probes（127.0.0.1:18130）

| Path | Result |
|---|---|
| `/xi` | 200 |
| `/admin` | 200 |
| `/admin/login` | 200 |
| `/api/admin/me`（无 Token） | 401 |

## Public health probes

| Path | Result |
|---|---|
| `https://www.xibull.com/xi` | 200 |
| `https://www.xibull.com/admin` | 200 |
| `https://www.xibull.com/admin/login` | 200 |

## Isolation health

| Stack | Status after deploy |
|---|---|
| zrhpay-production-web | Up（未停未改） |
| zrh-stage27-prod-web / api | healthy（未停未改） |
| xigame_prod_net / volumes | 保持独立 |

## Image timeline

| Tag / ID | Role |
|---|---|
| `dc0884cd2947` / `prod-pre-admin-20260809-232936` | Rollback baseline |
| `42553a66df30` | Admin allowlist 首版成功镜像 |
| `fabe8fc2457c` | 当前生产（含 email 加性 schema 修复） |

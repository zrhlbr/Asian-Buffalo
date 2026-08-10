# ADMIN_PRODUCTION_ROLLBACK_REPORT

**Date (UTC):** 2026-08-10  

## Rollback baseline

| Field | Value |
|---|---|
| PREVIOUS_PRODUCTION_IMAGE | `sha256:dc0884cd294768cba33a33201e131edf3594f828bc0a07f5f97c026f2647db55` |
| Rollback tag | `xigame-web:prod-pre-admin-20260809-232936` |
| Pre-admin source tar | `/home/zrh-admin/xigame-prod/backups/xigame-admin-tree-before-20260809-232936.tar` |

## Current production（若需回滚的起点）

| Field | Value |
|---|---|
| Current image | `sha256:fabe8fc2457c3162985cc27350a93d321b0a8ce3b8de5e867ae0e2e2f3b02b8c` |
| ROLLBACK READY | **YES** |

## Rollback procedure（西游戏 only）

```bash
cd /home/zrh-admin/xigame-prod/app/deploy/production
docker tag xigame-web:prod-pre-admin-20260809-232936 xigame-web:prod
docker compose up -d xigame-web
# wait healthy
docker inspect -f '{{.State.Health.Status}} {{.Image}}' xigame-web
curl -fsS -o /dev/null -w '/xi %{http_code}\n' http://127.0.0.1:18130/xi
curl -fsS -o /dev/null -w '/admin/login %{http_code}\n' http://127.0.0.1:18130/admin/login
```

可选：从 `xigame-admin-tree-before-*.tar` 还原 app 源树后再 build（若要以源码一致回滚）。

## Rollback verification checklist

- [ ] `/xi` 200  
- [ ] `/xi/bull-demon-king/play` 200  
- [ ] `/admin/login` 200  
- [ ] xigame-web / xigame-nginx healthy  
- [ ] ZRHPay / Accounts 未被触碰  

## Trigger conditions（本次未触发）

Admin Login FAIL / Dashboard FAIL / Player 回归 FAIL / Auth 异常 / 资金 Gate 意外打开 / container unhealthy → 立即 ROLLBACK。  
本次最终状态：**无需回滚**。

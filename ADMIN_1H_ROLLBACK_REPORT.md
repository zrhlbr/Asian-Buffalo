# ADMIN_1H_ROLLBACK_REPORT

| Item | Value |
|---|---|
| Current Production | `sha256:99c9e35443378313b13602cfdf43636fa04d2ae3835caab6153b2b75490cdb59` |
| Pre-1H tag | `xigame-web:prod-pre-admin-1h-20260810-202300` → `fabe8fc2457c…` |
| Original admin baseline | `xigame-web:prod-pre-admin-20260809-232936` → `dc0884cd2947…` |
| ROLLBACK READY | **YES**（标签未删除） |

```bash
cd /home/zrh-admin/xigame-prod/app/deploy/production
docker tag xigame-web:prod-pre-admin-1h-20260810-202300 xigame-web:prod
# or: docker tag xigame-web:prod-pre-admin-20260809-232936 xigame-web:prod
docker compose up -d xigame-web
# verify /xi /admin/login healthy
```

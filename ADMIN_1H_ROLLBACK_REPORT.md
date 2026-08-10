# ADMIN_1H_ROLLBACK_REPORT

| Item | Value |
|---|---|
| Current Production | `sha256:99c9e35443378313b13602cfdf43636fa04d2ae3835caab6153b2b75490cdb59` |
| Health | HEALTHY |
| Pre-1H | `xigame-web:prod-pre-admin-1h-20260810-202300` → `sha256:fabe8fc2457c3162985cc27350a93d321b0a8ce3b8de5e867ae0e2e2f3b02b8c` |
| Pre-admin baseline | `xigame-web:prod-pre-admin-20260809-232936` → `sha256:dc0884cd294768cba33a33201e131edf3594f828bc0a07f5f97c026f2647db55` |
| Tags deleted | **NO** |
| ROLLBACK READY | **YES** |

```bash
cd /home/zrh-admin/xigame-prod/app/deploy/production
docker tag xigame-web:prod-pre-admin-1h-20260810-202300 xigame-web:prod
# or baseline:
# docker tag xigame-web:prod-pre-admin-20260809-232936 xigame-web:prod
docker compose up -d xigame-web
# verify /xi /admin/login healthy
```

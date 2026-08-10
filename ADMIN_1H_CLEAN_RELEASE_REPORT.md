# ADMIN_1H_CLEAN_RELEASE_REPORT

**Date (UTC):** 2026-08-10  
**Mode:** Local Clean Release only — **NO PUSH / NO MERGE / NO REBASE / NO REDEPLOY**

---

## Release identity chain

```
M9 SOURCE COMMIT (freeze tip)
  0d1f194e6f16ffccfd0a96650b0bdd7898c3c84f
  code parent: d1c6f3e3b3f5981af24371f8bdfbebdec6744043
        ↓
M9 RELEASE TAG (annotated)
  xigame-admin-prod-20260810  →  0d1f194e6f16ffccfd0a96650b0bdd7898c3c84f
        ↓
M8 SOURCE COMMIT (Lobby Content Sync)
  01c4a83380d1408f1b0e4ce6aa44686c43562075
        ↓
M8 RELEASE TAG (annotated)
  xigame-admin-prod-20260810-lobby  →  01c4a83380d1408f1b0e4ce6aa44686c43562075
        ↓
BUILD / IMAGE (already on Production; not rebuilt this step)
  sha256:99c9e35443378313b13602cfdf43636fa04d2ae3835caab6153b2b75490cdb59
        ↓
CURRENT PRODUCTION IMAGE
  xigame-web:prod = sha256:99c9e35443378313b13602cfdf43636fa04d2ae3835caab6153b2b75490cdb59
  health = HEALTHY
        ↓
ROLLBACK IMAGE / TAG (retained)
  xigame-web:prod-pre-admin-1h-20260810-202300
    → sha256:fabe8fc2457c3162985cc27350a93d321b0a8ce3b8de5e867ae0e2e2f3b02b8c
  xigame-web:prod-pre-admin-20260809-232936
    → sha256:dc0884cd294768cba33a33201e131edf3594f828bc0a07f5f97c026f2647db55
```

---

## Dirty tree classification (M9)

| Class | Into release? |
|---|---|
| A Production 必需 admin/API/bootstrap | YES（82 files commit） |
| B ADMIN-1B～1G | YES |
| C ADMIN-1H 必要修复（public content routes / email ALTER） | YES |
| D ADMIN_1H_* / ADMIN_PRODUCTION_* 报告 | YES |
| E `.dev.vars` / secrets | **NO** |
| F `client/m5/*`、无关 docs、spins/wallet dirty | **NO** |
| G ZRHPay / Accounts | **NO** |

禁止 `git add .` — 已遵守。

---

## M8 scope

| Included | Excluded |
|---|---|
| `client/xi-lobby/api.ts` | `.dev.vars` |
| `client/xi-lobby/lobby-app.tsx` | 其它 xi-lobby / m5 / admin dirty |
| `client/xi-lobby/lobby.css` **仅 CMS banner + rec-empty 最小块** | 部署时曾混入的无关视觉 CSS dirty |

---

## Source ↔ Production 对账

| File | Clean source SHA256 (16) | Prod container SHA256 (16) | Match |
|---|---|---|---|
| banners/route.ts | 2880F3A24EC35E7B | 2880f3a24ec35e7b | YES |
| recommended-games/route.ts | 9CA57E45981DDF40 | 9ca57e45981ddf40 | YES |
| announcements/route.ts | 20E7EC83C469CCA9 | 20e7ec83c469cca9 | YES |
| player-content.ts | FBB9105FE417D9BD | fbb9105fe417d9bd | YES |
| player-commerce-bootstrap.ts | B657B679017F88B9 | b657b679017f88b9 | YES |
| xi-lobby/api.ts | 4CA0EF20E045120B | 4ca0ef20e045120b | YES |
| xi-lobby/lobby-app.tsx | 76224AB84F5440A0 | 76224ab84f5440a0 | YES |
| xi-lobby/lobby.css | F7224AAF858A4D34（CMS-only clean） | 1b12749c1de25748（deploy 时含额外视觉 dirty） | **NO byte-identical** |

**FUNCTIONALLY REPRODUCIBLE = YES**  
（Admin/API/Content Sync 行为源码与 Production 一致；`lobby.css` 非 CMS 视觉差异不影响 Content Sync 功能，且未重新切流。）

未对本轮做无意义 Production 重切流；Image SHA 保持 `99c9e354…`。

---

## Post-commit reverify

| Check | Result |
|---|---|
| ADMIN-1B～1G tests | **42/42 PASS** |
| Admin Login / Dashboard / Players / Wallet / Ledger / Risk / Audit / Content / CS / Admins / Sessions / Security | PASS（API_FAIL=0） |
| Player Lobby Content Sync APIs | PASS（public 200；recommended 含 bull-demon-king） |
| Player Smoke `/xi` `/login` `/play` | PASS 200 |
| Deposit Confirm / Withdraw Pay | `PROVIDER_NOT_CONFIGURED` FAIL CLOSED |
| PRODUCTION MONEY | NO / GATE CLOSED |
| RNG/RTP/Math/Paytable/Spin Core modified | **NO** |
| Rollback tags/images deleted | **NO** |

---

## Verdict

| Gate | Value |
|---|---|
| CLEAN RELEASE | **YES** |
| FUNCTIONALLY REPRODUCIBLE | **YES** |
| ROLLBACK READY | **YES** |
| ADMIN PRODUCTION READY | **YES** |
| FINAL FREEZE READY | **YES** |

# 《西游戏》Lobby Banner Remove — MODULE_IMPACT_ANALYSIS

**Date:** 2026-08-08  
**Rule:** Development Rules V2.0 — analyze before code; whitelist-only; NO commit/push/merge/deploy  
**Scope:** `/xi` lobby UI closure ONLY  
**Goal:** Remove standalone 【每日登录奖励 / 天天领好礼 / 查看签到】 banner; keep check-in inside 【活动中心】.

---

## 0. Hard bans (pre-code lock)

| Ban | Enforcement |
|-----|-------------|
| Hub / Play / Reel / Spin / Math / RTP / RNG | No edits to `bdk-hub.tsx`, `play-shell.tsx`, `client/m5/game/**` |
| Wallet business / Ledger / Settlement / Auth core / Admin | No API/DB/auth/admin business changes |
| Check-in **business** deletion | Keep `CheckinPanel`, `/api/v1/game/checkin`, Activity Center entry |
| Hydration / `#gl` stacking / GameClient keep-alive | Do not touch `xi-shell`, `game-host`, `layer-keepalive`, `game-lifecycle`, `nav` |
| Fake data / fake game click | Coming Soon cards → modal only; no fake jackpot/online |

---

## 1. Current state (pre-edit)

| Area | Location | Finding |
|------|----------|---------|
| Daily login banner | `lobby-app.tsx` ~758–772 `.xi-promo-banner` | Standalone section after 快捷功能; CTA opens `checkin` modal |
| Promo CSS | `lobby.css` `.xi-promo-*` + `@media 360` rules | Removable with banner |
| Promo i18n | `lobby.promo.loginTitle/loginSub/claim/enter` | Used **only** by banner (docs refs only); Activity Center uses `lobby.feat.checkin` |
| Check-in business | `commerce-panels.tsx` `CheckinPanel`; `api.ts` fetch/claim | Must keep |
| Activity entry | Bottom nav `activity` + quick `activity` + Activity panel button → check-in | Must keep |
| Recommended | HOT BDK + Coming Soon already; need dimmer unify | Polish only |
| Structure after | top → Hero → announce → recommended → quick → **banner** → bottom nav | Banner must go |

---

## 2. Target structure (home)

```
Top bar → Journey Hero → Announcement ticker → Recommended → Quick actions → Bottom fixed nav
```

No empty placeholder after quick; no new big banners.

---

## 3. ALLOWED_FILES (whitelist)

| File | Allowed change |
|------|----------------|
| `client/xi-lobby/lobby-app.tsx` | Remove promo banner block; activity/check-in entry placement; rec/quick polish only |
| `client/xi-lobby/lobby.css` | Remove promo styles; spacing after banner removal; rec dim; quick unify; top 320–430; bottom nav safe-area; light hero FX |
| `client/xi-lobby/i18n.ts` | Remove unused promo keys **only if** unused; keep `lobby.feat.checkin` and Activity Center keys; zh/en/my parity |
| `docs/m8-review/xi-game-v2/lobby-banner-remove/**` | Delivery package |

**Import-only (no business edits):** `commerce-panels.tsx` — CheckinPanel remains wired from Activity Center / modal.

---

## 4. FORBIDDEN_FILES

- `client/xi-lobby/bdk-hub.tsx`, `play-shell.tsx`, `game-host.tsx`, `game-lifecycle.ts`, `layer-keepalive.tsx`, `xi-shell.tsx`, `nav.ts`, `auth-*.tsx`
- `client/m5/**` game/reel/spin paths
- Wallet/ledger/math/RTP/session/spin/round routes; `app/admin/**`
- Check-in API routes / claim business logic

---

## 5. Regression must PASS

1. Banner gone from `/xi` home; shorter scroll; no odd gap above bottom nav  
2. Activity Center still opens; check-in reachable from Activity (not deleted)  
3. BDK recommended HOT card → Hub OK  
4. Coming Soon cards dimmer + 即将上线; no fake live click  
5. Quick actions ≥44px; red-dot consistent on activity; no dead buttons  
6. Top bar 320–430: no crush/overlap/lang clip  
7. Hero Journey art kept; LOW more static  
8. Hub/Play/hydration/`#gl` untouched  
9. i18n zh/en/my parity; do not delete keys still used by Activity Center  

---

## 6. Delivery STOP package

`docs/m8-review/xi-game-v2/lobby-banner-remove/`: FILE_LIST, before/after notes, mobile/lang shots or BLOCKED_CAPTURE, REGRESSION, git status, REVIEW_PATCH/SHA256 if feasible.

**NO commit / push / merge / deploy.**

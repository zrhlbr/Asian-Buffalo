# Step 2 — REVIEW_PATCH

**Patch file:** `AB-XI-STEP2-BDK-HUB-review.patch`  
**Scope:** `client/xi-lobby/*` + `app/xi/bull-demon-king/**`  
**SHA-256:** see `SHA256.txt`

## Summary of change

1. Replaced Step 1 hub stub with full 《西游戏之牛魔王》 hub (hero FX, top chrome, Start Game CTA, feature groups).
2. Added minimal `/xi/bull-demon-king/play` passthrough mounting existing `GameClient` (+ back to hub).
3. Extended lobby i18n with trilingual hub keys (groups, rules, wallet/VIP shells, empty rankings/records).
4. Added read-only `fetchVip` helper; no client balance mutation.
5. Extended CSS for clouds / cloak / feature groups; FX `pointer-events: none`.

## Forbidden untouched

- `client/m5/game/*` reel math / symbols / timing  
- Wallet / Ledger / Session / Spin / Round / RTP / RNG cores  
- `#gl` / `#hud` stacking contract in `client/m5/styles.css`  
- Admin core  

## Apply / rollback

- Apply: review patch against workspace (files already present for Zhao acceptance).  
- Rollback: restore stub `bdk-hub.tsx` + stub page/layout; delete `play/page.tsx` + `play-shell.tsx`; revert hub-only i18n/CSS additions.

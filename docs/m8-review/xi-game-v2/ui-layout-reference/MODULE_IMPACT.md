# MODULE_IMPACT — 《西游戏》UI Layout Refactor (Zhao reference)

**Date:** 2026-08-07  
**Rule:** Development Rules V2.0 — analyze before code; whitelist-only; NO commit/push  
**Reference:** `zhao-lobby-reference.png` (ChatGPT Image 2026-8-7)  
**Goal:** STRICT layout match (module order, hierarchy, nav, spacing) — not style-only.

---

## 0. Hard bans (pre-code lock)

| Ban | Enforcement |
|-----|-------------|
| Reel / Spin / Round / Session logic | No edits under `client/m5/game/*` spin path |
| Wallet API / Ledger / Math / RTP / Money logic | No edits to wallet/ledger routes, math, deposit settlement |
| Admin business | No `app/admin/**` |
| Dispose / recreate WebGL | Full navigation only; no shared `#gl` dispose |
| `#gl` stacking | Preserve `#gl { transform: translateZ(0) }`; never restore `#hud { transform: translateZ(0) }` |
| Catalog/API contracts | Prefer UI-only recommended-card presentation; do **not** change money APIs |

---

## 1. Asset search (before code)

| Search | Result |
|--------|--------|
| Journey / 西天取经 hero under `public/`, `docs/`, `client/**/assets/`, Cursor `assets/` | **Primary:** Zhao lobby mockup PNG (contains Journey painting in hero band) |
| Separate BDK full-bleed hero upload | **FOUND (2026-08-07)** — Zhao Viber upload wired to `/xi/heroes/bull-demon-king.png` |
| Journey hero | Cropped from Zhao lobby layout reference → `/xi/journey-hero.png` |

**Mitigation / wiring:**
1. Copy lobby reference → `public/xi/lobby-layout-reference.png` + `client/xi-lobby/assets/`
2. Crop Journey band → `public/xi/journey-hero.png`
3. **BDK hero CLEARED:** copy Zhao plate → `public/xi/heroes/bull-demon-king.png`; hub `<img object-fit:contain>`

---

## 2. Layout sections to match (Page 1 `/xi`)

| # | Section | Current gap | Target |
|---|---------|-------------|--------|
| 1 | Top bar | Lang buried in settings; no ID; single recharge; no wallet + | avatar \| nick+ID+VIP \| MMK+ \| USDT+ \| msg \| settings \| **中文 / မြန်မာ / EN** always visible |
| 2 | Full Hero | Procedural CSS only; asset-gap badge | Full Journey painting; no crop of main characters; light FX `pointer-events: none` |
| 3 | Announcement ticker | Missing under hero | speaker + scroll + 更多 |
| 4 | 推荐游戏 | Features first; grid; wrong titles | Horizontal cards: 牛魔王(HOT/gold) → 龙王/凤凰/财神/武林熊猫 + JACKPOT |
| 5 | 快捷功能 | 13-icon grid; wrong labels/order | 充值/提现/活动中心/VIP中心/排行榜/公告/客服 |
| 6 | Promo banner | Missing | 每日登录奖励 + 立即领取 |
| 7 | Bottom nav | Text labels OK; weak active chrome | 首页/游戏/钱包/活动/我的 — active gold/red like ref |

---

## 3. ALLOWED_FILES (whitelist)

| File | Allowed change |
|------|----------------|
| `client/xi-lobby/lobby-app.tsx` | Restructure home layout to reference section order; top chrome; ticker; recommended row; quick feats; promo; always-visible lang toggles; player ID display (presentation) |
| `client/xi-lobby/bdk-hub.tsx` | Same top chrome (avatar/VIP/MMK/USDT/msg/settings/三语); hero aesthetic; feature entries + Start Game → play; breadcrumb/back |
| `client/xi-lobby/play-shell.tsx` | Shell chrome / back / breadcrumb / transition only — **no** GameClient spin/math changes |
| `client/xi-lobby/lobby.css` | Layout, theme, responsive, ticker, horizontal cards, promo, bottom nav active, hero image fit, page transitions |
| `client/xi-lobby/i18n.ts` | New UI strings zh-CN / my-MM / en parity |
| `public/xi/*` | Serve journey hero + layout reference copies |
| `client/xi-lobby/assets/*` | Stable lobby asset copies |
| `docs/m8-review/xi-game-v2/ui-layout-reference/*` | Delivery gates only |

**Optional presentation-only (if needed for card titles):** `lib/lobby-catalog.ts` — **only** if UI cannot render 凤凰/财神/武林熊猫 without seed ids; no money fields. Prefer hardcoded recommended presentation in `lobby-app.tsx` to avoid API surface change.

---

## 4. FORBIDDEN_FILES

- `client/m5/game/reels.ts`, `reel-timing.ts`, `adapter.ts`, formal/mock providers
- `lib/wallet*`, ledger, math/RTP, spin/session/round routes
- `app/admin/**`, admin modules
- Any money settlement / channel business logic in `commerce-panels.tsx` beyond existing panel open hooks

---

## 5. Page scopes

### Page 1 — `/xi`
Restructure to reference module order 1→7. Navigation Lobby → hub intact.

### Page 2 — `/xi/bull-demon-king`
Same top chrome + 三语; magma/flame aesthetic; Start Game → `/xi/bull-demon-king/play`; back → `/xi`.

### Page 3 — play
Keep slot. Shell back → hub only. Preserve `#gl` translateZ. No spin/math edits.

---

## 6. i18n

All new strings in zh-CN / my-MM / en. Language toggles always visible on lobby + hub (labels: 中文 / မြန်မာ / EN). Persist via existing `xi-lobby-lang` storage (site-wide with play shell sync).

---

## 7. Delivery gates (this folder)

1. MODULE_IMPACT.md (this file — **before edits**)
2. LAYOUT_DIFF_CHECKLIST.md
3. FILE_LIST.md
4. REVIEW_PATCH / SHA256
5. before/after screenshots vs reference
6. i18n report
7. regression (play works, no black screen, `#gl` translateZ kept)
8. **NO commit / push**

---

## 8. Blast radius

```
/xi lobby-app + lobby.css + i18n + public/xi assets
/xi/bull-demon-king  bdk-hub + shared chrome CSS/i18n
/xi/bull-demon-king/play  play-shell chrome ONLY
╳ NOT m5 reel/spin/math/wallet/ledger/admin
```

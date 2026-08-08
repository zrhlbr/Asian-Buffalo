# 《西游戏》P2 Lobby Commercial UI/UX — LOBBY_P2_DELIVERY

**Date:** 2026-08-08  
**Scope:** `/xi` lobby ONLY  
**Commit/Push/Merge/Deploy:** **NONE** (forbidden)

---

## Verdict

P2 lobby commercial polish applied within whitelist. Reference section order preserved. Honest-data rules enforced (no fake winners / fake jackpots / client reward grants). Hub/Play warm-nav files untouched.

---

## Hero asset path (canonical)

| Role | Path |
|------|------|
| Journey master PNG | `public/xi/journey-hero.png` |
| Progressive WebP | `public/xi/heroes/journey-{low,mobile,tablet,desktop}.webp` |
| Progressive AVIF | `public/xi/heroes/journey-{low,mobile,tablet,desktop}.avif` |
| BDK rec-card image | `public/xi/heroes/bdk-mobile.webp` |
| Layout reference | `public/xi/lobby-layout-reference.png` |

Srcset declared widths: **720w / 1080w / 1440w** (maps mobile/tablet/desktop variants).

---

## Layout checklist vs Zhao reference

| # | Section | Status |
|---|---------|--------|
| 1 | Top player / wallet / 三语 always visible (中文\|မြန်မာ\|EN), gold active | **PASS** |
| 2 | Journey Hero — real art, no empty bg, mobile object-position protects pilgrims | **PASS** |
| 3 | Announcement marquee from real API; honest empty | **PASS** |
| 4 | Recommended: 牛魔王 HOT → hub; 龙王/凤凰/财神/武林熊猫 Coming Soon; jackpot only if real | **PASS** |
| 5 | Quick actions: recharge/withdraw/activity/VIP/rankings/announce/CS — real or Coming Soon | **PASS** |
| 6 | Daily login banner — opens server CheckinPanel; no client grant | **PASS** |
| 7 | Bottom nav 首页/游戏/钱包/活动/我的 + safe-area | **PASS** |

---

## Code changes (whitelist)

- `client/xi-lobby/lobby-app.tsx` — honest ticker, rec cards, lazy BDK image, rankings panel, CS Coming Soon, cache after hydrate
- `client/xi-lobby/lobby.css` — hero crop, ticker static, rec art, LOW/MED FX cut, 320–360 polish
- `client/xi-lobby/i18n.ts` — empty ticker / promo enter / rec soon; duplicate key cleanup; zh/en/my parity
- `client/xi-lobby/quality.ts` — 720/1080/1440 srcset; LOW particles = 0
- `client/xi-lobby/api.ts` — session cache for profile/balance (real data only)
- `app/xi/loading.tsx` — light shell loading (non-black)

**Untouched (regression protection):** `xi-shell.tsx`, `game-host.tsx`, `layer-keepalive.tsx`, `game-lifecycle.ts`, `nav.ts`, `play-shell.tsx`, `bdk-hub.tsx`, m5 reel/spin/math, wallet settlement, admin.

---

## Regression status (code-path)

| Check | Status | Evidence class |
|-------|--------|----------------|
| Hub↔Play warm files untouched | **PASS** | FILE_LIST / git path filter |
| `#gl` translateZ preserved in CSS comments+rules | **PASS** | `lobby.css` unchanged on `#gl`/`#hud` stacking |
| No `#hud` shell translateZ added | **PASS** | CSS review |
| Fake jackpot / fake winners removed | **PASS** | lobby-app + i18n |
| i18n key parity zh/en/my | **PASS** | `assertLobbyI18nComplete()` → ok |
| Visual screenshots / video | **BLOCKED** | See `BLOCKED_CAPTURE.md` |

---

## Evidence package

See sibling files in this folder: MODULE_IMPACT, MOBILE_LAYOUT, PERFORMANCE, I18N, REGRESSION, ASSET, REVIEW_PATCH, SHA256, FILE_LIST, BLOCKED_CAPTURE, git-status.txt.

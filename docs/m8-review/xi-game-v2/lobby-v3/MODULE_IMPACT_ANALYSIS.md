# 《西游戏》Lobby V3 Boutique Polish — MODULE_IMPACT_ANALYSIS

**Date:** 2026-08-08  
**Rule:** Development Rules V2.0 — analyze before code; whitelist-only; NO commit/push/merge/deploy  
**Scope:** `/xi` lobby ONLY (boutique polish)  
**Structure (locked):** Top → Journey Hero → Announcements → Recommended → Quick actions → Bottom nav  
**Ban:** Do NOT reintroduce Daily Login big banner.

---

## 0. Hard bans (pre-code lock)

| Ban | Enforcement |
|-----|-------------|
| Hub core logic / Play / Reel / Spin / RNG / RTP / Math / Round / Settlement | Zero edits under `client/m5/game/**`; no hub/play rewrites |
| Wallet-Ledger / Deposit-Withdrawal / VIP business / Auth core / Admin | No settlement logic; no `app/admin/**`; no auth-core changes |
| Daily Login big banner | Must stay removed (check-in only via Activity panel/modal) |
| P0 hydration / P1 warm nav / GameClient keep-alive | No edits to `xi-shell`, `game-host`, `layer-keepalive`, `game-lifecycle`, `nav` dispose paths |
| `#gl` / `#hud` stacking | Keep `#gl { transform: translateZ(0) }`; never shell `translateZ` on `#hud` |
| Fake data | No fake jackpot winners / fake online / client-granted rewards |
| Auto-start Dragon King / Hub·Play rewrites | Forbidden |
| Commit / push / merge / deploy | Forbidden this package |

---

## 1. Asset inventory (before code)

| Search | Result |
|--------|--------|
| `public/xi/heroes/journey-{low,mobile,tablet,desktop}.webp` | **FOUND** |
| `public/xi/heroes/journey-*.avif` | **FOUND** |
| `public/xi/journey-hero.png` / fallback | **FOUND** via `quality.ts` |
| `public/xi/heroes/bdk-mobile.webp` (rec card eager) | **FOUND** |
| Progressive ladder 720 / 1080 / 1440 | Already wired in `heroSrcSet` / `heroAvifSrcSet` |

**Rule:** Phone uses mobile/low WebP/AVIF — never serve 4K desktop master on 320–430.

---

## 2. Current gaps vs V3 boutique goals

| # | Goal | Current | V3 target |
|---|------|---------|-----------|
| 1 | Hero FX 5–8s | Rays often too busy; MED clouds `animation:none` | LOW=static; MED=light clouds; HIGH/ULTRA=light rays + spirit dots; no heavy blur/canvas |
| 2 | Recommended | HOT + soon badges present | Stronger BDK gold HOT glow; soon dimmer; tap → trilingual Coming Soon only |
| 3 | Quick actions | 7 icons ≥44px | Unify icon size/radius/stroke/hover/red-dot; no dead buttons |
| 4 | Announcements | Real API + honest empty | Keep; scroll + 更多; no fake winners |
| 5 | Top wallets / VIP / lang | Lang switch OK | HIGH-only wallet/VIP breath; LOW no heavy number anim; lang <300ms no reload |
| 6 | Bottom nav + order | Banner removed; order OK | Polish + safe-area; confirm structure |
| 7 | Assets | WebP/AVIF exist | Lazy non-first rec cards; srcset intact |
| 8 | Mythic black-gold | Layout V2 maroon-gold | Unify boutique black-gold look |
| 9 | i18n | Keys largely parity | Parity scan zh/en/my |
| 10 | Mobile 320–430 | Partial | Layout + SIMULATED perf notes |

---

## 3. ALLOWED_FILES (whitelist)

| File | Allowed change |
|------|----------------|
| `client/xi-lobby/lobby-app.tsx` | Lobby UX polish only (hero FX markup, rec/quick/top/nav presentation) |
| `client/xi-lobby/lobby.css` | Boutique visuals, responsive, tier FX, safe-area — **do not** regress `#gl`/`#hud` |
| `client/xi-lobby/i18n.ts` | Lobby UI string parity (zh/en/my) |
| `client/xi-lobby/quality.ts` | Lobby FX particle counts / hero helpers only |
| `client/xi-lobby/quality-panel.tsx` | Progressive hero presentation only if needed |
| `docs/m8-review/xi-game-v2/lobby-v3/**` | Delivery package |

**Import-only (no business edits):** `api.ts`, `commerce-panels.tsx`, `ui-store.ts` — consume existing APIs/panels only.

---

## 4. FORBIDDEN_FILES

- `client/xi-lobby/bdk-hub.tsx`, `play-shell.tsx`, `game-host.tsx`, `game-lifecycle.ts`, `layer-keepalive.tsx`, `xi-shell.tsx`, `nav.ts`, `auth-app.tsx`, `auth-api.ts`
- `client/m5/game/**`, reel/spin/math paths
- Wallet/ledger/session/spin/round API business; `app/admin/**`
- Deposit/withdraw/VIP settlement logic rewrites

---

## 5. Regression must PASS (code-path verify)

- Lobby `/xi`, Hub, Play, back nav
- Wallet display / VIP read / Auth entry / lang switch
- Quick actions / Recommended / Bottom nav
- P0 hydration / P1 warm nav / GameClient keep-alive
- `#gl` translateZ kept; no `#hud` shell translateZ
- Capture if possible else `BLOCKED_CAPTURE.md`

---

## 6. Delivery gates (this folder)

1. MODULE_IMPACT_ANALYSIS.md (**this file — before edits**)
2. LOBBY_V3_DELIVERY.md
3. MOBILE_REPORT.md
4. PERFORMANCE_REPORT.md
5. I18N_REPORT.md
6. REGRESSION_REPORT.md
7. ASSET_REPORT.md
8. REVIEW_PATCH / SHA256 / FILE_LIST / git status
9. Screenshots/videos or BLOCKED_CAPTURE
10. **NO commit / push / merge / deploy**

---

## 7. Blast radius

```
/xi lobby-app + lobby.css + i18n + quality(+panel if needed)
╳ NOT hub business / play / reel / wallet-ledger settlement / admin / auth core
╳ NOT xi-shell / game-host / layer-keepalive / game-lifecycle / nav warm path
╳ NOT Daily Login banner reintroduction
```

---

## 8. Proceed gate

Impact analysis complete. Implementation may begin on ALLOWED_FILES only.

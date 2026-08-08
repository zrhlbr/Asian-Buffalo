# 《西游戏》P2 Lobby Commercial UI/UX — MODULE_IMPACT_ANALYSIS

**Date:** 2026-08-08  
**Rule:** Development Rules V2.0 — analyze before code; whitelist-only; NO commit/push/merge/deploy  
**Scope:** `/xi` lobby ONLY  
**Reference structure (order fixed):** Top → Journey Hero → Announcement → Recommended → Quick actions → Daily login → Bottom nav  

---

## 0. Hard bans (pre-code lock)

| Ban | Enforcement |
|-----|-------------|
| Hub business core | No changes to BDK hub business flows beyond shared CSS/i18n if unavoidable; prefer lobby-only |
| Play / Reel / Spin / RNG / RTP / Math / Round / Settlement | No `client/m5/game/*` spin path; no math/RTP |
| Wallet-Ledger / Deposit-Withdrawal / VIP business / Admin | No settlement logic; no `app/admin/**`; commerce panels may open existing read/claim UI only |
| Hub↔Play warm nav / hydration / GameClient keep-alive | Do not regress `xi-shell`, `game-host`, `layer-keepalive`, `game-lifecycle`, `nav` dispose paths |
| `#gl` / `#hud` stacking | Keep `#gl { transform: translateZ(0) }`; never put shell `translateZ` on `#hud` |
| Fake data | No fake winners, fake jackpots, fake games, client-granted rewards |

---

## 1. Asset search (before code)

| Search | Result |
|--------|--------|
| `public/xi/heroes/journey-*` | **FOUND** — WebP + AVIF: low / mobile / tablet / desktop |
| `public/xi/journey-hero.png` | **FOUND** — PNG fallback master |
| `client/xi-lobby/assets/journey-hero.png` | **FOUND** — workspace copy |
| `public/xi/heroes/bull-demon-king.png` | **FOUND** — BDK card / hub plate |
| `public/xi/lobby-layout-reference.png` | **FOUND** — Zhao layout reference |

**Progressive target:** 720 / 1080 / 1440 WebP+AVIF (map existing mobile/tablet/desktop widths; regenerate labels in `quality.ts` srcset).

---

## 2. Current gaps vs P2 goals

| # | Section | Gap | Target |
|---|---------|-----|--------|
| 1 | Top 三语 | Mostly done; verify gold active, no reload, no hydration mismatch | Keep always-visible 中文\|မြန်မာ\|EN |
| 2 | Journey Hero | Wired; refine mobile object-position for pilgrims; tier FX | Real art, no empty bg; light clouds/particles by quality |
| 3 | Announcement | Fake default ticker winner string | Real API marquee; honest empty |
| 4 | Recommended | Fake jackpot `888,888,888`; CSS-only card art | BDK HOT first; others Coming Soon; jackpot only if real; lazy non-first images |
| 5 | Quick actions | Rankings modal placeholder; CS → pending | Real panels or Coming Soon; mythic icons; no dead buttons |
| 6 | Daily login | Opens CheckinPanel (OK) | Entry + server claim only; never client grant |
| 7 | Bottom nav | Present + safe-area | Keep; polish 320–430 |
| Perf | LOW/MED | Partial blur/particle cuts | Cut heavy bloom/blur/particles; CSS transform/opacity; cache avatar/balance/VIP |

---

## 3. ALLOWED_FILES (whitelist)

| File | Allowed change |
|------|----------------|
| `client/xi-lobby/lobby-app.tsx` | Lobby polish: ticker honesty, rec cards, lazy images, rankings/CS modals, cache shell, promo entry |
| `client/xi-lobby/lobby.css` | Lobby layout/responsive/FX tiers/hero object-position/bottom nav — **do not** regress `#gl`/`#hud` rules |
| `client/xi-lobby/i18n.ts` | Lobby UI strings zh/en/my parity (no hard-coded Chinese in UI) |
| `client/xi-lobby/quality.ts` | Hero srcset widths / particle counts (presentation) |
| `client/xi-lobby/quality-panel.tsx` | Progressive hero only if needed for 720/1080/1440 |
| `client/xi-lobby/api.ts` | Read-only cache helpers for profile/balance if presentation-only |
| `app/xi/loading.tsx` | Lobby loading shell polish only |
| `public/xi/**`, `client/xi-lobby/assets/**` | Serve/copy lobby heroes if needed |
| `docs/m8-review/xi-game-v2/lobby-p2/**` | Delivery package |

**Import-only (no business edits):** `commerce-panels.tsx` — may import `RankingsPanel` / `CheckinPanel` already exported.

---

## 4. FORBIDDEN_FILES

- `client/m5/game/**` spin/reel/math paths
- `client/xi-lobby/bdk-hub.tsx`, `play-shell.tsx`, `game-host.tsx`, `game-lifecycle.ts`, `layer-keepalive.tsx`, `xi-shell.tsx`, `nav.ts` — **no edits** unless a pure shared CSS class collision forces a one-line comment-safe fix (prefer zero touch)
- Wallet/ledger/math/RTP/session/spin/round routes; `app/admin/**`
- Deposit/withdraw/VIP settlement business logic

---

## 5. Regression must PASS

- `/xi`, hub, play load
- hydration mismatch = 0
- black screen = 0
- Hub↔Play warm nav not regressed
- wallet display / i18n OK
- `#gl` translateZ kept; no `#hud` shell translateZ

---

## 6. Delivery gates (this folder)

1. MODULE_IMPACT_ANALYSIS.md (this file — **before edits**)
2. LOBBY_P2_DELIVERY.md
3. MOBILE_LAYOUT_REPORT.md
4. LOBBY_PERFORMANCE_REPORT.md
5. I18N_REPORT.md
6. REGRESSION_REPORT.md
7. ASSET_REPORT.md
8. REVIEW_PATCH / SHA256 / FILE_LIST
9. Screenshots PC/tablet/320–430 + 3 langs; videos or BLOCKED_CAPTURE
10. **NO commit / push / merge / deploy**

---

## 7. Blast radius

```
/xi lobby-app + lobby.css + i18n + quality(+panel) + optional api cache + public/xi heroes
╳ NOT hub business / play / reel / wallet-ledger settlement / admin
╳ NOT xi-shell / game-host / layer-keepalive / game-lifecycle / nav warm path
```

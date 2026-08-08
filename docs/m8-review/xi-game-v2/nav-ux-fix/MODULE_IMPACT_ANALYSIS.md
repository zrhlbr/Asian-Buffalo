# Nav UX Fix — 《西游戏》 Navigation / Breadcrumb / Transitions — MODULE_IMPACT_ANALYSIS

**Date:** 2026-08-07  
**Branch:** feature/ab-r1-m8-cursor  
**Rule:** Development Rules V2.0 — analyze **before** code; ONE MODULE (nav UX). STOP after delivery.  
**NO** commit / push / merge / deploy.

---

## 1. Goal (this run ONLY)

Complete Layer 1–3 navigation UX for 《西游戏》:

| Layer | Route | Required nav chrome |
|-------|-------|---------------------|
| 1 Home | `/xi` | **No** back button |
| 2 Hub | `/xi/bull-demon-king` | Top-left `← 返回大厅` → `/xi` (~300ms slide-right); breadcrumb `西游戏 > 西游戏之牛魔王` (西游戏 clickable) |
| 3 Play | `/xi/bull-demon-king/play` | Top-left `← 返回牛魔王首页` → hub; Home `🏠 返回大厅` → `/xi`; breadcrumb 3-level clickable; safe-leave while spinning |

Also: mobile edge swipe (LTR), PC ESC one-level, page transitions 200–300ms, i18n zh/my/en for nav labels.

---

## 2. Baseline (gap analysis — before edits)

| Item | Current | Gap |
|------|---------|-----|
| Lobby back | No dedicated back (home) | OK — keep |
| Hub `← 返回大厅` | CSS `.xi-bdk-back-xi` exists; **no visible button** mounted | **MISSING** — breadcrumb Link reuses `data-testid=xi-hub-back-lobby` as brand crumb only |
| Hub breadcrumb | Present: brand → hub title | OK structure; ensure click → lobby + separator `>` |
| Play back → hub | `data-testid=xi-play-back-hub` + safe-leave | Partial OK |
| Play Home → lobby | **Absent** | **MISSING** |
| Play breadcrumb | **Absent** | **MISSING** |
| Page transitions | Hard `location.assign` / Link only | **MISSING** slide/zoom/fade |
| Edge swipe LTR | **Absent** | **MISSING** |
| ESC one-level | **Absent** | **MISSING** |
| Spin-busy guard | Play leave confirm present | Reuse; disable swipe/ESC auto-leave while busy/modal |
| `#gl` / `#hud` | `#gl { translateZ(0) }`; no `#hud` shell translateZ | **Preserve — do not touch** |

---

## 3. Whitelist (ALLOWED_FILES)

| File | Change |
|------|--------|
| `client/xi-lobby/nav.ts` | **NEW** — router helpers: transition navigate, edge swipe, ESC, layer resolve, storage flags |
| `client/xi-lobby/bdk-hub.tsx` | Visible back button; breadcrumb testids; wire swipe/ESC/transition enter+leave |
| `client/xi-lobby/play-shell.tsx` | Home button; breadcrumb; ESC; swipe; transition enter; leave via hub/lobby with confirm |
| `client/xi-lobby/lobby-app.tsx` | Lobby→hub navigate with slide-left transition only; **no** back button |
| `client/xi-lobby/lobby.css` | `.xi-nav-*` / transition / breadcrumb / play home styles; **no** `#gl`/`#hud` transform |
| `client/xi-lobby/i18n.ts` | Additive nav keys (home / crumb / back aliases) zh/my/en |
| `docs/m8-review/xi-game-v2/nav-ux-fix/**` | Delivery package |

### Absolute-minimal shared touch

| File | Touch? | Why |
|------|--------|-----|
| `client/m5/**` game/spin/wallet | **NO** | Forbidden |
| `app/admin/**` | **NO** | Forbidden |
| `app/xi/**/layout.tsx` / pages | **NO** unless mount comment only — shells already mounted |
| Wallet / commerce panels | **NO** | Forbidden |

---

## 4. Forbidden

- Wallet / Reel / Spin / Math / RTP / Settlement / Ledger / Admin
- Changing `#gl { transform: translateZ(0) }` or adding `#hud { transform: translateZ(0) }`
- Commit / push
- New money APIs or math

---

## 5. Navigation contract

```
/xi  --(BDK card, Slide Left)-->  /xi/bull-demon-king  --(开始游戏, Zoom+Fade)-->  /xi/bull-demon-king/play
 ^                                   ^                                              |
 |----(← 返回大厅 / swipe / ESC, Slide Right)----|                                  |
                                                 |<----(← 返回牛魔王首页 / swipe / ESC, Fade+Slide)--|
                                                 +----(🏠 返回大厅)--------------------------------> /xi
```

| From → To | Transition | Duration |
|-----------|------------|----------|
| lobby → hub | Slide Left | 200–300ms |
| hub → lobby | Slide Right | ~300ms |
| hub → play | Zoom + Fade | 200–300ms |
| play → hub | Fade + Slide | 200–300ms |

---

## 6. Interaction rules

- **Explicit UI required** — do not rely on browser Back alone.
- While spin busy: keep existing safe-leave confirm; **disable** edge swipe leave; ESC must not leave without confirm / modal closed.
- ESC: one level up; configurable (localStorage `xi-nav-esc`, default **on**); ignore when modal/dialog open.
- Edge swipe: left-edge LTR only; play→hub, hub→lobby; disable while spin busy.

---

## 7. data-testid contract (gates)

| Element | testid |
|---------|--------|
| Hub back | `xi-hub-back-lobby` (button/link with label 返回大厅) |
| Hub breadcrumb root | `xi-hub-breadcrumb` |
| Hub crumb lobby | `xi-hub-crumb-lobby` |
| Play back hub | `xi-play-back-hub` |
| Play home lobby | `xi-play-home-lobby` |
| Play breadcrumb | `xi-play-breadcrumb` |
| Lobby root (no back) | `xi-lobby-root` — assert no `xi-*-back-*` |

---

## 8. Risk / rollback

| Risk | Mitigation |
|------|------------|
| Transition overlay steals clicks / buries `#gl` | Overlay on document root only during leave; never transform `#hud`/`#gl` |
| Swipe steals reel gestures | Left-edge zone (~24px); disabled when `#btn-spin.busy` |
| Mid-spin leave | Reuse play-shell confirm / wait |
| i18n missing keys | Additive keys with zh/my/en parity |

Rollback: revert whitelist files; shells fall back to prior Link/`location.assign`.

---

## 9. Delivery gates (this folder)

1. MODULE_IMPACT_ANALYSIS.md (this file — **before code**)
2. NAV_E2E.md + smoke script + smoke-results.json
3. I18N.md
4. FILE_LIST.md
5. REVIEW_PATCH.md + patch / SHA256
6. Screenshots
7. ACCEPTANCE.md checklist vs user §验收

**STOP** after delivery — no commit/push.

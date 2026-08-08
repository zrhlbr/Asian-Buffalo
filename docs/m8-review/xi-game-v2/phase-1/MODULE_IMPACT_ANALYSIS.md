# 《西游戏》V2.0 Phase 1 — MODULE_IMPACT_ANALYSIS

**Module:** Game Lobby only（西游戏 / XI GAME）  
**Date:** 2026-08-07  
**Rule:** Development Rules V1 + V2 — one module; analyze before code; no unrelated modules.

---

## 1. Goal (Phase 1 ONLY)

Ship an **additive** platform lobby (西游戏 / XI GAME) as the home for all future games, with:

- Hero banner (Journey asset if present; else placeholder + ASSET_GAP)
- Top bar (avatar / nickname / VIP · MMK+USDT · messages / announcements / settings / language)
- Mid catalog (Recommended / Hot / New / JACKPOT + BDK playable card + coming-soon myth cards)
- Feature entries (all clickable; real overlay or i18n “coming soon”)
- Bottom nav (Home / Games / Wallet / Activity / Me) inside lobby shell
- Trilingual i18n (zh-CN / en / my-MM)
- Navigation target to existing slot + `/xi/bdk` stub

**Explicitly NOT in this phase:** Phase 2 BDK hero home, Phase 3 slot commercial changes, admin UI write-path, wallet deposit/withdraw business rules, commit/push/merge/deploy.

---

## 2. Current state (baseline)

| Surface | Route / path | Notes |
|--------|----------------|-------|
| Playable slot | `/` → `app/page.tsx` → `GameClient` → `client/m5/*` | MUST remain playable |
| Admin | `/admin` | Not modified this phase (Rule 6: admin sync pending) |
| Profile API | `GET/PATCH /api/v1/game/profile` | Reuse (fail-closed) |
| Balance API | `GET /api/v1/game/wallet/balance` | Single currency today (typically MMK) |
| Announcements | `GET /api/v1/game/announcements` | Reuse |
| VIP APIs | `/api/v1/game/vip/*` | Available; lobby opens VIP modal stub/reuse |
| Playwright | Not configured in `package.json` | Smoke unit test + BLOCKED note for headed capture if needed |
| Journey / 西游 HD assets | **Not found** under `assets/`, `docs/`, `uploads/`, `public/` | ASSET_GAP → CSS placeholder hero |

P0 canvas stacking (`#gl { transform: translateZ(0) }`, NO `#hud { transform: translateZ(0) }` shell) lives in `client/m5/styles.css` — **do not touch**.

---

## 3. In-scope changes (Lobby module only)

### 3.1 New routes (additive)

| Route | Role |
|-------|------|
| `/xi` | Platform lobby shell (Phase 1 acceptance URL) |
| `/xi/bdk` | Bull Demon King hub stub → link to slot (`/` and `/game`) — **no reel rewrite** |
| `/game` | Additive alias mounting existing `GameClient` (same stack as `/`) |

**Preserved:** `/` continues to mount the playable slot unchanged.

### 3.2 New frontend

- `client/xi-lobby/*` — React lobby UI, CSS, i18n (isolated from `client/m5`)
- `app/xi/layout.tsx`, `app/xi/page.tsx`, `app/xi/bdk/page.tsx`
- `app/game/page.tsx` — thin `GameClient` remount

### 3.3 Minimal API / config

- `GET /api/v1/lobby/catalog` — additive JSON catalog (static config in `lib/lobby-catalog.ts`)
- Fail-closed: never invent wallet balances as truth; loading / error / unavailable states are honest
- USDT meter: show loading/unavailable until a real multi-currency balance contract exists (CONTRACT note)

### 3.4 Docs / gates (this folder)

Impact report, delivery report, FILE_LIST, REVIEW_PATCH, SHA256, RISK, ROLLBACK, GATE_RESULTS, I18N keys, ASSET_GAP, screenshots or BLOCKED_CAPTURE.

---

## 4. Out of scope (must not change)

| Area | Reason |
|------|--------|
| `client/m5/game/*`, reel timing, symbols, math | Phase 3 / slot integrity |
| Session / Spin / Round / Ledger / RTP | Engineering acceptance bar |
| `#gl` / `#hud` stacking CSS | P0 black-screen fix |
| Admin CMS write UI (M9 sync) | Deferred — CONTRACT: lobby reads catalog API; admin authoring later |
| African Buffalo proprietary art scrape | IP rule |
| Phase 2 BDK hero home | Wait for Zhao acceptance |

---

## 5. Dependency & blast radius

```
/xi (Lobby React)
  ├─ GET /api/v1/lobby/catalog          [NEW, additive]
  ├─ GET /api/v1/game/profile           [READ existing]
  ├─ GET /api/v1/game/wallet/balance    [READ existing]
  ├─ GET /api/v1/game/announcements     [READ existing]
  ├─ GET /api/v1/game/vip               [READ optional]
  └─ navigate → /xi/bdk → / or /game    [no dispose of m5 internals]

/ and /game
  └─ GameClient / client/m5/*           [UNCHANGED behavior]
```

**globals.css:** `body { overflow: hidden }` remains for slot. Lobby uses an internal scroll root so game pages are unaffected.

---

## 6. Admin sync (Rule 6)

- Phase 1: **lobby-config read API** with static seed catalog (BDK live + myth games coming-soon).
- Admin panel in M8/M9: **not edited** this phase.
- CONTRACT: future admin “Lobby Catalog” module may PATCH the same schema; until then frontend must not show dead buttons (coming-soon modals OK).

---

## 7. i18n

All new lobby UI strings live in `client/xi-lobby/i18n.ts` with full **zh-CN / en / my-MM**. No hardcoded user-visible strings in JSX beyond temporary SSR fallback that mirrors default locale keys.

---

## 8. Regression checklist (must pass before “Phase 1 done”)

1. `/` still boots slot (canvas `#gl` present; no black-screen CSS regression)
2. `/game` also boots slot
3. `/xi` renders lobby; bottom nav switches panels
4. BDK card → `/xi/bdk` → Play → `/` or `/game`
5. Coming-soon cards open modal, not 404
6. Feature entries open modal/page
7. Profile/balance/announcements fail-closed (loading/error, no fake “truth” balances)
8. Build / Lint / TypeCheck / unit smoke PASS; Playwright honest BLOCKED if absent

---

## 9. Risk summary (pre-code)

| Risk | Mitigation |
|------|------------|
| Accidentally replace `/` with lobby | Keep `/` = GameClient; lobby only at `/xi` |
| Touching m5 styles breaks stacking | Zero edits to `#gl`/`#hud` stacking rules |
| Fake USDT/MMK display | Honest loading/error/unavailable |
| Dead feature buttons | Every entry opens real modal with i18n pending copy |
| Scope creep into Phase 2/3 | Hub stub only; no BDK hero home / reel work |

---

## 10. Approval to proceed

This analysis is the gate before implementation. Implementation follows **exactly** the in-scope list in §3.

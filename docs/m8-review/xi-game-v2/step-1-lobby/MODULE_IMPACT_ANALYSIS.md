# Step 1 ONLY — 《西游戏》大厅首页 `/xi` — MODULE_IMPACT_ANALYSIS

**Date:** 2026-08-07  
**Rule:** Development Rules — ONE STEP ONLY. Analyze before further edits.

---

## 1. Goal (this run ONLY)

Polish and accept **【《西游戏》游戏大厅首页 `/xi`】** then **STOP**.

| In scope | Out of scope (do NOT build) |
|----------|------------------------------|
| Full lobby layout at `/xi` | Full 《西游戏之牛魔王》 hub UI |
| Journey / heavenly court / immortal-qi hero | 《牛魔王》 play page work |
| BDK card → real next-route **entry** (stub OK) | New game FX |
| Lobby features + bottom nav + i18n | New admin modules |
| PC / tablet / phone responsive | Wallet / Ledger / Math / Spin core |

**Acceptance note after PASS:** 等待验收后再进入第二步.

---

## 2. Baseline

| Surface | Status |
|---------|--------|
| `/xi` | Existing full `LobbyApp` (mythic shell from prior work) — polish + gates |
| `/xi/bull-demon-king` | Previously over-built hub — **must collapse to minimal stub** this run |
| `/xi/bull-demon-king/play` | Over-built — **remove / do not deliver as Step 2** |
| `/` slot | Must remain playable; no `#gl`/`#hud` stacking changes |
| Journey HD art | Search repo; if missing → ASSET_GAP + cinematic CSS fallback |

---

## 3. Planned whitelist edits

| Area | Change |
|------|--------|
| `client/xi-lobby/*` | Lobby polish only (layout/hero/i18n/CSS/responsive) |
| `app/xi/page.tsx`, `layout.tsx` | Lobby mount / title |
| `app/xi/bull-demon-king/page.tsx` (+ tiny layout) | **Minimal stub**: title + 验收后开发 + back `/xi` |
| `app/xi/bull-demon-king/play/**` | Remove play shell delivery (Step 2 not started) |
| `app/xi/bdk/page.tsx` | Keep redirect → stub route (legacy links) |
| `lib/lobby-catalog.ts` | `href: "/xi/bull-demon-king"` only |
| Docs | `docs/m8-review/xi-game-v2/step-1-lobby/*` |

**Not touched:** `client/m5/*` game/math, wallet/ledger APIs business rules, admin modules, `#gl`/`#hud` stacking CSS.

---

## 4. Next-route stub contract

`/xi/bull-demon-king` = real route entry for card click:

- Title: 西游戏之牛魔王 (i18n)
- Body: 验收后开发 / After acceptance
- Link: ← 返回西游戏 → `/xi`
- **No** full feature grid, **no** Start Game CTA to play, **no** play page work

---

## 5. Risks

| Risk | Mitigation |
|------|------------|
| Slot regression | Do not edit m5 / game-client spin path |
| Accidental Step 2 | Stub-only hub; delete play page |
| Dead buttons | Features open existing modals / pending UI |

---

## 6. Proceed

Whitelist-only lobby polish + stub next-route. Step 2 NOT started.

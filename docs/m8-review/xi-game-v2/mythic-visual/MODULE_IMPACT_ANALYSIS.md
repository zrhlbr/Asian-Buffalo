# 《西游戏》Mythic Visual Unification — MODULE_IMPACT_ANALYSIS

**Module:** Presentation / visual / FX / HUD decoration / ambient audio ONLY  
**Date:** 2026-08-07  
**Rule:** Development Rules V2.0 HIGHEST — analyze → whitelist → implement one page → regress → next  
**Branch:** `feature/ab-r1-m8-cursor`  
**Admin:** M9 only if brand i18n strings needed — **prefer player-only this round**

---

## 0. Three-layer brand language

| Layer | Surface | Visual identity |
|-------|---------|-----------------|
| **天庭 / Immortal qi** | Page 1 `/xi` Lobby | Jade tablet, gold edge, cloud sea, god rays, palace silhouette, crane, gold spirit — **most immortal qi** |
| **Heaven × Demon clash** | Page 2 `/xi/bdk` Hub | Heaven gold/clouds/thunder ABOVE; immortal mountains/palace MID; Flame Mountain / lava / demon qi BELOW; BDK center |
| **Flame-mountain combat** | Page 3 `/` + `/game` Slot | Combat + flame-mountain tint of same brand; reel remains #1 subject; light mythic chrome on frame only |

---

## 1. Hard bans (pre-code lock)

| Ban | Enforcement |
|-----|-------------|
| NO Spin / Wallet / Ledger / Math / RTP / Round / Session / API contracts / DB / Admin core | Whitelist excludes `lib/game*`, wallet/ledger routes, math, admin modules |
| NO dispose renderer | Never call dispose / recreate WebGL; hub uses full navigation |
| Preserve P0 stacking | `#gl { transform: translateZ(0) }` stays; **NEVER** restore `#hud { transform: translateZ(0) }` shell |
| Reel first subject on page 3 | No FX covering symbols; frame chrome at edges only |
| Symbol IDs unchanged | buffalo / wild / scatter etc. — visual chrome / tint / accent only |
| One page at a time | Page1 → regress → Page2 → regress → Page3 → regress |
| NO commit / push / merge | Delivery docs only |
| Trilingual i18n | All new UI strings in zh-CN / my-MM / en — no hardcoded copy |

---

## 2. Asset search (before code)

| Search | Result |
|--------|--------|
| Zhao-provided 西天取经 / Journey HD hero under `public/`, `docs/`, `client/**/assets/`, `uploads/` | **Not found** (avatars + favicon only in `public/`) |
| Filenames matching 西游 / 西天 / journey / xiyou / hero / banner / palace | **0 matches** |

**Mitigation:** Upgrade CSS/canvas procedural layers; document in `ASSET_GAP.md`. Do not scrape third-party art.

---

## 3. Per-page whitelists

### Page 1 — `/xi` Lobby（西天取经入口）— MOST immortal qi

| File | Allowed change |
|------|----------------|
| `client/xi-lobby/lobby-app.tsx` | Hero layer markup (clouds / mountains / palace / rays / cranes / particles / mist); topbar jade-tablet classes; feature icon motif data attrs; lang-scoped display font hooks |
| `client/xi-lobby/lobby.css` | Immortal-qi hero layers; jade+gold topbar; feature icon motifs (cloud/lotus/jingubang/jade/palace); reduced-motion; zh-only display font |
| `client/xi-lobby/i18n.ts` | New presentation strings only (trilingual parity) |

**Out of whitelist:** `app/xi/page.tsx` / `layout.tsx` (mount only — no change unless CSS import path required), catalog API, wallet/profile APIs, `client/m5/*`, admin, `/` slot.

**Gate:** Lobby usable; all entries clickable; slot `/` untouched.

---

### Page 2 — `/xi/bdk` 西游戏之牛魔王 hub

| File | Allowed change |
|------|----------------|
| `client/xi-lobby/bdk-hub.tsx` | Layered heaven / mid / flame-mountain / BDK figure chrome; Start Game as heavenly token with press FX then navigate `/game` or `/`; optional lightweight procedural ambient via WebAudio (no new media files) |
| `client/xi-lobby/lobby.css` | Hub scene layers, demon qi / thunder / array / weapon flow (CSS), decree button press FX |
| `client/xi-lobby/i18n.ts` | Hub presentation strings (trilingual) |

**Out of whitelist:** Slot mount, Session/Spin APIs, reel code, admin.

**Gate:** Navigation to `/game` and `/` intact; back to `/xi` intact; not a pure-dark demon page.

---

### Page 3 — Slot `/` or `/game` 《牛魔王》

| File | Allowed change |
|------|----------------|
| `app/game-client.tsx` | Additive DOM mythic frame / ambient layers (`pointer-events: none`); celebration mythic accent nodes — **no** `#hud` shell `translateZ(0)` |
| `client/m5/styles.css` | Frame chrome, HUD combat/flame tint, celebration mythic accents; **preserve** `#gl { transform: translateZ(0) }`; do not add `#hud { transform: translateZ(0) }` |
| `client/m5/win-presentation.ts` | Presentation mapping only: particleStyle / pillars / light mythic accent fields — **no** payout / duration that alters spin settlement timing contract (~6s spin path untouched) |
| `client/m5/scene/particles.ts` | Style colors for temple/divine / mythic accents (visual only) |
| `client/m5/scene/world.ts` | Subtle sky/fog/cloud color wash toward mythic dusk / distant lightning mood — **must not** shrink reel fill or occlude symbols |
| `client/m5/game/symbol-life.ts` | Wild/Scatter visual motif hints (tint/accent) — IDs unchanged |
| `client/m5/i18n.ts` | New presentation-only strings if any (trilingual) |

**Explicitly FORBIDDEN on page 3:**

- `client/m5/game/reel-timing.ts`, spin duration math
- `client/m5/game/reels.ts` layout / fill / stop timing (frame glow already exists — prefer not to change stop path)
- `client/m5/adapter.ts`, formal-provider, mock payout
- Wallet / ledger / session / round routes
- Symbol ID renames or paytable values
- Disposing / recreating renderer

**Gate:** Canvas not black; reel+symbols visible; buttons work; spin timing untouched (~6s); navigation from hub still lands.

---

## 4. Blast radius diagram

```
Page1 /xi ──► xi-lobby CSS/JSX/i18n only
Page2 /xi/bdk ──► bdk-hub + shared lobby.css/i18n (hub section)
Page3 / | /game ──► game-client DOM chrome + m5 styles + win-presentation
                     + light world/particles/symbol-life visual hints
                     ╳ NOT reel-timing / wallet / math / #hud translateZ
```

---

## 5. Fonts

| Locale | Titles | Body |
|--------|--------|------|
| zh-CN | May use expressive display (e.g. ZCOOL XiaoWei / Noto Serif SC) | Readable sans |
| en / my-MM | **Must NOT** force Chinese calligraphy look — Cinzel / Noto Sans Myanmar / system sans | Same readable stacks |

Scope via `[lang="zh-CN"]` / `:lang(zh-CN)` where display calligraphy applies.

---

## 6. Regression checklist (after EACH page)

1. Canvas not black (`#gl` promoted; no `#hud` shell translateZ)
2. Page 3: reel + symbols visible; fill/margins unchanged
3. Buttons work (lobby features, hub Start Game, slot Spin/Auto/Bet)
4. Navigation: `/xi` ↔ `/xi/bdk` ↔ `/game` or `/`
5. i18n parity for every new key (zh-CN / en / my-MM)
6. Spin timing untouched (~6s) — page 3 only
7. Money / math / wallet / ledger / RTP untouched

---

## 7. Delivery package (this folder)

`MODULE_IMPACT_ANALYSIS.md` (this file), `FILE_LIST.md`, `REVIEW_PATCH.md`, `SHA256.txt`,  
`REGRESSION_PAGE1.md` / `PAGE2` / `PAGE3`, `BEFORE_AFTER.md`, screenshots or `BLOCKED_CAPTURE.md`,  
`RISK.md`, `ROLLBACK.md`, `ASSET_GAP.md`.

---

## 8. Approval to proceed

Implementation follows **exactly** the per-page whitelists in §3, one page at a time, with regression between pages. No commit/push/merge.

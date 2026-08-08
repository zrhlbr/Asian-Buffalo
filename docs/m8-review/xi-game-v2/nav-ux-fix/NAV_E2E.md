# Nav UX Fix — NAV_E2E

**Date:** 2026-08-07  
**Base URL:** `http://127.0.0.1:5173`  
**Script:** `_smoke-nav.mjs`  
**Result:** **13 PASS / 0 FAIL** (see `smoke-results.json`)

---

## Gates

| ID | Check | Result |
|----|-------|--------|
| G1 | Layer1 `/xi` — no back button (`xi-hub-back-lobby` / `xi-play-back-hub` absent) | PASS |
| G2 | Lobby → hub via BDK card | PASS |
| G3 | Hub visible `← 返回大厅` (`data-testid=xi-hub-back-lobby`) | PASS |
| G4 | Hub breadcrumb crumb → lobby | PASS |
| G5 | Hub back button click → lobby | PASS |
| G6 | Hub → play; `#gl` present; `#hud` shell transform none | PASS |
| G7 | Play `← 返回牛魔王首页` → hub | PASS |
| G8 | Play Home `🏠 返回大厅` + breadcrumb chrome → lobby | PASS |
| G9 | Play breadcrumb hub crumb → hub | PASS |
| G10 | i18n back labels zh / en / my | PASS |
| G11 | ESC on hub → lobby (default on) | PASS |

---

## Screenshots

| File | Scene |
|------|-------|
| `screenshots/01-lobby-no-back.png` | Lobby home (no back) |
| `screenshots/02-hub-zh.png` | Hub with back + breadcrumb |
| `screenshots/03-hub-crumb-to-lobby.png` | After crumb → lobby |
| `screenshots/04-play-gl.png` | Play with `#gl` + nav chrome |
| `screenshots/05-play-to-hub.png` | After play back → hub |
| `screenshots/06-play-home-lobby.png` | After play home → lobby |
| `screenshots/07-hub-i18n.png` | Hub lang toggle chrome |

---

## Manual notes (not automated)

| Interaction | Implementation |
|-------------|----------------|
| Edge swipe LTR | `attachEdgeSwipe` — left edge ≤28px; disabled while spin busy / modal |
| ESC on play | `attachEscNav` → `requestLeave("hub")`; confirm if spin busy |
| Transitions | leave overlay 200–300ms; play enter = opacity veil only (no `#gl` ancestor transform) |
| Spin safe-leave | Existing confirm/wait retained |

---

## Re-run

```bash
node docs/m8-review/xi-game-v2/nav-ux-fix/_smoke-nav.mjs http://127.0.0.1:5173
```

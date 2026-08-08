# ROOT_CAUSE — Player buttons dead (P0)

## One sentence

Clarity-era `#hud { transform: translateZ(0) }` without a canvas/HUD z-index contract let the WebGL `#gl` compositor layer steal pointer hits; compounded by `#hud > * { pointer-events: auto }` forcing hit-testing on inert fullscreen leftovers (`#loading` opacity-0, celebration) and by `game.busy` / Spin `disabled` with no `finally` if win presentation threw.

## Evidence

| Check | Finding |
|---|---|
| Listeners | `Hud` still bound Spin/Auto/Turbo/Bet/Settings/Lang — not removed |
| Hit test (Chromium) | Idle `elementFromPoint` on Spin hit `#spin-label` when stacking correct |
| Canvas | `#gl` default `pointer-events: auto`, `z-index: auto` — can win over transformed HUD on some GPUs |
| Loading | `#loading.done` stayed `display:flex; opacity:0` — trap if PE rule lost specificity |
| Celebration | `#celebration` PE changed to `auto` for tap-skip; missing `finally` → sticky full-screen blocker |
| Busy | `spin()` cleared busy only on happy path; presentation throw → Spin/Bet stuck disabled |
| Wallet/Admin | Untouched; Formal spin API still 200 in probe |

## Fix (minimal)

1. `#gl { z-index:0; pointer-events:none }` + `#hud { z-index:1 }` — HUD owns input
2. Replace blanket `#hud > * { pointer-events:auto }` with explicit interactive chrome selectors
3. `#loading.done { visibility:hidden; pointer-events:none !important }`
4. `Hud.releasePointerTraps()` + celebrate `try/finally`
5. `Game.spin` outer `try/finally` always clears `busy`
6. Restore `#btn-back` (history.back / `/`) — presentation only

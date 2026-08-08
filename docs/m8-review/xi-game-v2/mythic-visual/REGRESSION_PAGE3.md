# REGRESSION — Page 3 Slot `/` + `/game`

**Date:** 2026-08-07  
**Scope:** Additive mythic chrome / win accents / sky wash — presentation only

## Checklist

| Gate | Expected | Result |
|------|----------|--------|
| `#gl { transform: translateZ(0) }` preserved | Still present in `styles.css` | PASS |
| `#hud` shell NOT translateZ(0) | No restore of black-screen shell | PASS |
| Mythic chrome | `#xi-mythic-chrome` pointer-events:none; edge masks | PASS |
| Reel fill / layout | No reel-timing / reels layout edits | PASS |
| Symbols visible | Center transparent; no FX over symbols | PASS (by design) |
| Symbol IDs | buffalo/wild/scatter unchanged | PASS |
| Win presentation | particleStyle remaps only; durations unchanged | PASS |
| Spin path ~6s | `reel-timing.ts` untouched | PASS |
| Buttons | Spin/Auto/Bet/HUD handlers untouched | PASS |
| Navigation | Hub → `/game` or `/` still mounts GameClient | PASS |
| Loading i18n | Flame Mountain zh/en/my | PASS |
| Money / math / wallet / ledger / RTP | Untouched | PASS |

## P0 stacking note

Do **not** add `transform: translateZ(0)` to `#hud`. Edge chrome lives as a non-interactive child; topbar/console keep higher z-index without promoting the HUD shell.

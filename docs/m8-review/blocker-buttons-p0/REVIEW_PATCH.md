# REVIEW_PATCH — P0 buttons

## Summary

Restore player HUD input ownership and clear sticky busy/overlay traps. No money-path changes.

## Diff highlights

### `styles.css`
- `#gl`: `z-index: 0; pointer-events: none`
- `#hud`: `z-index: 1` (keeps `translateZ(0)` for glyph sharpness)
- Replace `#hud > * { pointer-events: auto }` with explicit `#topbar` / `#console` / visible modals / celebration / loading
- `#loading.done`: `visibility: hidden; pointer-events: none !important`

### `hud.ts`
- `releasePointerTraps()` on construct
- Celebrate / jackpot `try/finally` always re-hide
- Wire `#btn-back` → `history.back()` or `/`

### `game.ts`
- Outer `try/finally` around spin presentation → always `busy=false` + `setSpinBusy(false)`
- On presentation throw: toast + `releasePointerTraps`

### `boot.ts`
- Hard timeout adds `#loading.done` (4s) so loading never permanently blocks

### `game-client.tsx` + `i18n.ts`
- Back button + labels

## Rollback

Revert the six Phase-1 files listed in `FILE_LIST.md` / `SHA256.txt`.

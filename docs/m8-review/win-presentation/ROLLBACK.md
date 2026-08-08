# M8 Win Presentation — Rollback

## Fast rollback (presentation only)

1. Restore / delete:
   - `client/m5/win-presentation.ts`
   - `tests/r1-m8-win-presentation.test.mjs`
   - `docs/m8-review/win-presentation/`
2. Revert modified presentation files to pre-upgrade versions:
   - `client/m5/adapter.ts` (remove super/epic bands)
   - `client/m5/audio.ts`
   - `client/m5/game/game.ts` (restore `winTier` + `fireTierEffects`)
   - `client/m5/game/reels.ts` / `symbol-life.ts`
   - `client/m5/scene/buffalo.ts` / `world.ts` / `particles.ts`
   - `client/m5/ui/hud.ts` / `i18n.ts` / `styles.css`
   - `tests/r1-m8-symbol-life.test.mjs`
3. Re-run: `node --experimental-strip-types --test tests/r1-m8-*.test.mjs`

## Partial rollback

Keep Super/Epic multiplier bands + HUD labels, but temporarily map all choreography to the previous Big/Mega/Ultra/Jackpot FX by editing `TIER_CHOREOGRAPHY` only.

## Safety

Rollback does not touch server money/math paths (they were never modified).

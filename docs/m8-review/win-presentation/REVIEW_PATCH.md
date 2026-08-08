# M8 Commercial Win Presentation Upgrade — Review Patch

**Scope:** Presentation ONLY  
**Date:** 2026-08-07  
**Commit:** none (explicitly not committed)

## Summary

Upgraded Asian Buffalo from Big/Mega/Ultra/Jackpot-only celebrations to a full international commercial win ladder (line → fullscreen animal → multiplier bands including **Super** and **Epic**), plus Free Spin enter choreography. Clarity V2 improvements already in `client/m5` were kept; no reel edge / timing / direction / money changes.

## Key implementation

- **Resolver:** `client/m5/win-presentation.ts` → `resolvePresentationTier(result)` from line length, grid animal fill, win/bet multiplier.
- **Choreography:** data-driven `TIER_CHOREOGRAPHY` (buffalo / audio / particles / camera / HUD / wash / lightning / slow-mo).
- **Orchestration:** `Game.presentWinTier` / `presentFreeSpinEnter` / `applyChoreography`.
- **Multiplier bands:** Big 10 / Mega 25 / Ultra 50 / **Super 70** / **Epic 85** / Jackpot 100 (UI_ONLY).

## Tests run

```
node --experimental-strip-types --test \
  tests/r1-m8-win-presentation.test.mjs \
  tests/r1-m8-symbol-life.test.mjs \
  tests/r1-m5-integration.test.mjs \
  tests/r1-m6-presentation.test.mjs \
  tests/r1-m8-reel-timing.test.mjs \
  tests/r1-m8-reel-direction.test.mjs
```

Result: **pass** (win-presentation + symbol-life: 19/19; related suite previously 46/47 then fixed to green).

## Capture

See `BLOCKED_CAPTURE.md` — no fake videos.

## Companion docs

- `TIER_MATRIX.md`
- `FILE_LIST.md`
- `SHA256.txt`
- `PERFORMANCE_REPORT.md`
- `RISK_REPORT.md`
- `ROLLBACK.md`
- `ASSET_GAP.md`

# PERFORMANCE_REPORT

## Measured this run

| Surface | Evidence | Result |
|---------|----------|--------|
| PC headed capture lobby/hub/play | Playwright shots OK | Visual path loads; **no FPS number recorded** |
| Android / iPhone / Tablet FPS | — | **NOT TESTED** |
| Auto quality downgrade | Code present (`client/m5/quality.ts`) | Not re-benchmarked this RC |

## Constraints preserved

- `#gl { transform: translateZ(0) }` retained (blackscreen P0)
- `#hud` shell **without** translateZ (verified in `client/m5/styles.css`)
- No reel-timing / animal-core rewrites in this package

## Verdict

Performance commercial gate for mobile: **NOT TESTED / NOT CLAIMED**.  
PC visual smoke only — insufficient for FPS PASS.

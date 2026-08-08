# TEST_RESULTS — blocker + 6s timing

## Command

```
node --experimental-strip-types --test \
  tests/r1-m8-symbol-life.test.mjs \
  tests/r1-m8-reel-timing.test.mjs \
  tests/r1-m8-reel-direction.test.mjs \
  tests/r1-m8-clarity-v2.test.mjs \
  tests/r1-m8-win-presentation.test.mjs
```

## Result

**44/44 PASS** (0 fail)

Key contracts:
- Symbol life API + downward direction
- `NORMAL_SPIN_TOTAL_MS === 6000`, stops `[4200,4600,5000,5400,5800]`, bounce → 6000
- Turbo independent 2–3s
- Free spin / auto share `spinAll(..., this.turbo)` + `spinTimingProfile`
- No money/math module imports in presentation path

## Headed / Playwright probe

- Idle + post-spin screenshots: **symbols visible** (buffalo / wild / letters / animals)
- `MeshBasicMaterial` tiles: opacity 1 on visible rows; edge fade rows opacity 0
- Wall-clock busy duration in headless Chromium inflated by RAF/software WebGL throttle — **not** used as timing authority; unit contract is source of truth

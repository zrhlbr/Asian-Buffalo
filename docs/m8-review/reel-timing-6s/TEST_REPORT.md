# Reel Timing 6s — Test Report

**Command (M8):**

```bash
node --experimental-strip-types --test \
  tests/r1-m8-reel-timing.test.mjs \
  tests/r1-m8-reel-direction.test.mjs \
  tests/r1-m8-clarity-v2.test.mjs \
  tests/r1-m8-win-presentation.test.mjs \
  tests/r1-m8-symbol-life.test.mjs
```

**Result:** **43/43 PASS** (2026-08-07)

## Checklist vs instruction §九

| # | Check | Result |
|---|---|---|
| 1 | Normal Spin ≈ 6s | **PASS** (contract: total 6000; stops+bounce exact) |
| 2 | Reel always down | **PASS** (direction + motion monotonic tests) |
| 3 | Five columns stagger stop | **PASS** ([4200…5800]) |
| 4 | Final Grid correct | **PASS** (reel-direction stop-window / setGrid tests) |
| 5 | Balance correct | **NOT RUNTIME-TESTED** this pass (no money code touched; prior formal path unchanged) |
| 6 | No double-click during spin | **PASS** (source contract: `if (this.busy) return`) |
| 7 | Auto no concurrent request | **PASS** (busy gate + auto only after busy clear — source) |
| 8 | Turbo OK | **PASS** (2500ms independent profile) |
| 9 | Free Spin OK | **PASS** (uses `spinTimingProfile(this.turbo)` — non-turbo = 6s) |
| 10 | Recovery no reverse spin | **PASS** (recovery uses `setGrid`) |
| 11 | Phone / tablet / PC consistent | **NOT HEADED-TESTED** (same client constants) |
| 12 | Animal / win FX intact | **PASS** (win-presentation + symbol-life suites green) |

## Configured stop times (ms from animation start)

| Reel | Stop |
|---|---|
| 1 | 4200 |
| 2 | 4600 |
| 3 | 5000 |
| 4 | 5400 |
| 5 | 5800 |
| Bounce end | **6000** (`NORMAL_BOUNCE_MS=200`) |

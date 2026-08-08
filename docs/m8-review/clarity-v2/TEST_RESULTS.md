# Test Results — Clarity V2

**Command:**
```bash
node --experimental-strip-types --test \
  tests/r1-m8-clarity-v2.test.mjs \
  tests/r1-m8-clarity.test.mjs \
  tests/r1-m8-reel-timing.test.mjs \
  tests/r1-m8-reel-direction.test.mjs \
  tests/r1-m8-symbol-life.test.mjs \
  tests/r1-m8-commercial.test.mjs
```

**Result (2026-08-07):** **43 / 43 pass**, 0 fail  
**Duration:** ~0.54s

Covered:
- DPR caps high/mid/low
- renderScale + DEGRADE_ORDER
- Symbol 1024 native dimensions ×13
- Reel pixel-align / sharp restore contracts
- Direction down + ~10s / 1.35 timing unchanged
- Composer DPR sync + bloom caps
- HUD CSS soft-glow reduction
- Existing Phase3 / commercial / symbol-life / reel suites green

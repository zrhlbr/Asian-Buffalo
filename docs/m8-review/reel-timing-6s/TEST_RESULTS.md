# TEST_RESULTS — reel-timing-6s

```
node --experimental-strip-types --test tests/r1-m8-reel-timing.test.mjs tests/r1-m8-reel-direction.test.mjs
```

Included in the combined M8 suite: **44/44 PASS**.

## Measured column stop times (contract)

| Reel | Hard stop (ms) | Notes |
|---|---|---|
| 0 | 4200 | before bounce |
| 1 | 4600 | |
| 2 | 5000 | |
| 3 | 5400 | |
| 4 | 5800 | + `NORMAL_BOUNCE_MS` 200 → **total 6000** |

Turbo last stop 2350 + bounce 150 → **2500** total.

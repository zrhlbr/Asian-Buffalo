# Rollback — Reel Timing 6s

Presentation-only. Restore prior constants in `client/m5/game/reel-timing.ts`:

```ts
export const NORMAL_SPIN_TOTAL_MS = 10_000;
export const NORMAL_REEL_STOP_MS = [8000, 8400, 8800, 9200, 9700] as const;
export const NORMAL_BOUNCE_MS = 300;
// SPIN_SPEED_MULT = 1.35 unchanged
// accelEnd in spinMotionProgress was 0.075
```

Also revert test expectations in:

- `tests/r1-m8-reel-timing.test.mjs`
- `tests/r1-m8-clarity-v2.test.mjs`
- `tests/r1-m8-win-presentation.test.mjs`

Mirror the same in M9 if that tree was synced.

No DB / API / wallet rollback required.

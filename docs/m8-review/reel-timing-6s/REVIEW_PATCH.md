# REVIEW_PATCH — normal spin ~6s

## Final constants

| Constant | Value |
|---|---|
| `NORMAL_SPIN_TOTAL_MS` | **6000** |
| `NORMAL_REEL_STOP_MS` | **[4200, 4600, 5000, 5400, 5800]** |
| `NORMAL_BOUNCE_MS` | **200** (last stop 5800 + 200 = 6000) |
| `TURBO_SPIN_TOTAL_MS` | **2500** |
| `TURBO_REEL_STOP_MS` | **[1400, 1650, 1900, 2150, 2350]** |
| `TURBO_BOUNCE_MS` | **150** |
| `SPIN_SPEED_MULT` | **1.35** (unchanged) |

## Motion envelope (normal)

- Accel ~0–0.4s of first reel window (`spinMotionProgress` accelEnd=0.095)
- Cruise mid strip
- Staggered hard stops 4.2–5.8s
- Overshoot + bounce ~5.8–6.0s

## Shared path

`Game.spin` → `rig.spinAll(grid, turbo)` → `spinTimingProfile(turbo)`  
Normal / Auto / Free Spin (non-turbo) all use the 6000ms profile. Turbo stays independent.
Direction: `REEL_SPIN_DIRECTION = "down"` (top→bottom).

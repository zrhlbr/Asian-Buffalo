# M8 Win Presentation — Performance Report

## Priority

Phone 60FPS first. Degrade **particles before** Buffalo / HUD / Symbol clarity (matches Clarity V2 `DEGRADE_ORDER`).

## Particle budgets (existing quality profiles)

| Tier | coinBudget | particleBudget | Win presentation behavior |
|------|------------|----------------|---------------------------|
| high | 220 | 400 | Full choreography counts (clamped by pool) |
| medium | lower | lower | `burstSparks` / rain already clamp to budget |
| low | lowest | lowest | Same clamp; pillars/style retained; DPR not sacrificed |

## Win presentation cost notes

- Coin rain rate scales by tier (`setCoinRainRate`) but never exceeds pool `coinBudget`.
- `burstSparks` already caps via `particleBudget / 20`.
- Celebration bloom capped at 0.52 (Clarity V2 — protects symbol edges).
- Slow-mo scales world `dt` only during celebration mood (presentation); **spin timing authority unchanged**.
- Low quality: reduce particle counts first — symbol life intensity stays ≥ 1; HUD overlays remain sharp.

## Evidence status

Headed device FPS capture for each win tier was **not** completed in this package (see `BLOCKED_CAPTURE.md`). Unit/contract tests for timing/direction/grid passed.

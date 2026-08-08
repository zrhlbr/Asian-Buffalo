# FPS_REPORT

**Date:** 2026-08-07  
**Honesty gate:** No headed mid-range phone was available in this agent session.

## Classification

| Claim | Status |
|-------|--------|
| Unit: FpsGovernor step-down &lt;35 for ~sustain window | **MEASURED** (node test) |
| Unit: no bounce-up hysteresis | **MEASURED** (node test) |
| PC desktop idle/spin FPS | **NOT MEASURED** this session (no headed capture run) |
| Mid-range Android 30–45 FPS fluency | **SIMULATED ONLY** — never REAL DEVICE PASS |
| 30-minute stability | **SIMULATED / BLOCKED** — cannot run long headed soak here |

## Governor contract (code)

- Default `lowMark = 35`, `sustainMs = 3800`, `allowStepUp = false`
- Order: ULTRA → HIGH → MEDIUM → LOW → soft `renderScale 0.92`
- Manual quality modes disable governor step-down application in boot (`qualityMode !== "auto"`)

## Simulated mid-phone expectation (not a pass)

| Scene | Expected AUTO | Simulated FPS band |
|-------|---------------|--------------------|
| Lobby | MEDIUM | 45–60 DOM |
| Hub | MEDIUM | 40–55 DOM |
| Slot idle | MEDIUM/LOW after step-down | 30–45 WebGL |
| Slot win FX | budgets cut by tier | avoid sub-25 sustained |

**Do not treat this table as REAL DEVICE PASS.**

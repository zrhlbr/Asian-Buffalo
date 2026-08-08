# BLOCKED_CAPTURE

## Videos A–F

**BLOCKED** — no headed device / screen recorder in this agent environment.

## Available evidence

| Artifact | Status |
|----------|--------|
| `e2e-results.json` | 20-loop timings + singleton/black/hydration |
| `debug-nav-results.json` | 8-loop warm confirmation |
| `screenshots/hub-after-20-loops.png` | May exist if E2E screenshot step ran |
| Playwright iPhone 13 SIMULATED | Used for all nav timings |

## Recommended acceptance capture (human)

1. Phone: Hub idle → hover Start → Start → back ×20  
2. Record with perf trace `?xiPerf=1`  
3. Confirm single `#gl` in DevTools after loops  

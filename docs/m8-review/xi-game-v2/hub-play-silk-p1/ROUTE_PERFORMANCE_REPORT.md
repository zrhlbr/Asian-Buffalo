# Route Performance Report — Hub↔Play P1

**Device:** Playwright `iPhone 13` SIMULATED (headless)  
**Metric:** UI-first — host `ACTIVE` / `SUSPENDED` (not RSC pathname settle)  
**Source:** `e2e-results.json` (20 loops)

## Before → After

| Direction | Before | After (avg) | After (p50) | Target |
|-----------|--------|-------------|-------------|--------|
| Hub→Play | ~2700ms | **374ms** | **413ms** | ≤500ms warm |
| Play→Hub | ~3800ms | **93ms** | **87ms** | ≤300–500ms |
| Click feedback | — | **15ms** | **13ms** | ≤80ms |

Warm Hub→Play (loops after first): typically **122–497ms** (min 122).  
First loop often ~700ms (warm boot completing).

## Residual vs 500ms

- Warm Hub→Play **meets** ≤500ms on p50 and avg.  
- p95/max **724ms** on first/cold-adjacent loop — residual WebGL warm if idle prefetch incomplete.  
- Play→Hub **beats** 300–500ms band (avg 93ms).  
- URL `/play` may lag UI by ~500–700ms (RSC); UI already ACTIVE.

## Perf trace

Toggle: `localStorage.xi-perf-trace=1` or `?xiPerf=1`  
Marks: `routeClickAt` → `clickFeedbackAt` → `activateReady` / `suspendDone` → `transitionEnd`

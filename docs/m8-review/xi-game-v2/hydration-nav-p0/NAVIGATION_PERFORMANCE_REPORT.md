# NAVIGATION_PERFORMANCE_REPORT

**Date:** 2026-08-07  
**Base:** `http://127.0.0.1:5173`  
**Source:** `e2e-results.json` (pass=true)

## Click → feedback

| Metric | Value |
|--------|------:|
| Avg click→`xi-nav-pending` / transition overlay | **4 ms** |
| Target | &lt;100 ms |
| Result | **PASS** |

Measured in-page via MutationObserver around native click dispatch (excludes Playwright actionability wait).

## Warm nav (20-loop averages)

| Step | Avg ms | Notes |
|------|-------:|-------|
| Lobby → Hub | **515** | Soft router; well under ~2s |
| Hub → Lobby | **568** | Soft router |
| Hub → Play | **2746** | Includes GameClient / WebGL boot |
| Play → Hub | **3852** | Includes M5 destroy + hub mount |

Shell-only transitions (lobby↔hub) are warm and fast. Play path cost is dominated by intentional WebGL lifecycle, not black-gap stalls.

## Mobile SIMULATED

| Item | Value |
|------|-------|
| Viewport | 390×844 |
| Network | Slow-4G-approx (CDP) |
| CPU | 4× throttle |
| Full Lobby→Hub→Play→Hub→Lobby | **11988 ms** |
| Note | **SIMULATED** (not headed physical device) |

## Verdict

- No ~2s black void on warm lobby↔hub  
- Click feedback &lt;100ms  
- Play enter/leave slower due to renderer boot/teardown — acceptable; no hydration black trap

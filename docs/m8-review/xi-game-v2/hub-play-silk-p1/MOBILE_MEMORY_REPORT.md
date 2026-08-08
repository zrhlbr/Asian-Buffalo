# Mobile Memory Report (SIMULATED)

**Device:** Playwright iPhone 13 profile (no physical device in this run)

## Strategy

| Tier | Suspend behavior |
|------|------------------|
| LOW | `releaseHeavyFx` → particle/coin budgets → 0; keep WebGL context |
| MEDIUM | Pause RAF/audio; keep budgets |
| HIGH/ULTRA | Pause RAF/audio; keep more FX cache for instant resume |

## Evidence (20 loops)

- `__xiGameClientCount` ≤ 1  
- `canvas#gl` count ≤ 1  
- Lifecycle after leave: `SUSPENDED` (not `DISPOSED`)  
- No dispose on routine Hub↔Play → avoids allocator churn from full World rebuild

## Gap

True Safari/Chrome mobile heap snapshots **BLOCKED** (no headed device). SIMULATED only.

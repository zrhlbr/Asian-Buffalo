# MEMORY_REPORT

**Date:** 2026-08-07  
**Honesty:** No Chrome Performance / about:memory capture in this session.

## Measured (code / assets)

| Item | Evidence |
|------|----------|
| Particle / coin pools | Existing `Particles` Pool — no per-frame alloc in hot path |
| Win FX churn | Budgets capped by tier; FX-off clamps particleBudget ≤40 |
| Hero bytes | Journey desktop WebP ~47 KB vs master PNG ~609 KB |
| BDK desktop WebP | ~128 KB vs master ~253 KB |
| Single AudioContext | `AudioEngine.ensure()` never recreates; background suspends |

## Simulated / blocked

| Item | Status |
|------|--------|
| JS heap after 30 min slot | **BLOCKED** — no soak |
| GPU memory / texture atlas | **SIMULATED** — LOD reduces grass/clouds/shadow maps only |
| Route leave dispose leak | Code path: `bootM5.destroy` cancels rAF, removes listeners, `world.dispose`, pauses audio — **not** heap-proved |

## Guardrails

- Prefer soft degrade over reallocating World
- Remount after destroy creates fresh World (no reuse of disposed GL)
- Never dispose mid-spin for quality changes — only applyQuality / budgets

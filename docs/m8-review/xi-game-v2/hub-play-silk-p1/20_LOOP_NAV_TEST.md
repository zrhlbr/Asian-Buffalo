# 20-Loop Hub↔Play Nav Test

**Script:** `_e2e-hub-play-silk.mjs`  
**Results:** `e2e-results.json`  
**Device:** iPhone 13 SIMULATED

## Summary

| Metric | avg | p50 | p95 | max | min |
|--------|-----|-----|-----|-----|-----|
| Hub→Play ms | 374 | 413 | 724 | 724 | 122 |
| Play→Hub ms | 93 | 87 | 326 | 326 | 43 |
| Click feedback ms | 15 | 13 | 33 | 33 | 11 |

## Probes

| Probe | Result |
|-------|--------|
| Hydration errors | 0 |
| Unhandled errors | 0 |
| Black probe fails | 0 |
| Duplicate GameClient | 0 |
| Duplicate `#gl` canvas | 0 |
| Lifecycle after leave | SUSPENDED |
| Locales zh/en/my | OK (separate goto pass) |

## Singleton proof

After 20 loops: `__xiGameClientCount === 1`, `document.querySelectorAll('canvas#gl').length === 1`, AudioContext not recreated (warmup sets `__xiAudioContextCount = 1`).

# Quality Preload Matrix

| Asset / work | LOW | MEDIUM | HIGH/ULTRA | When |
|--------------|-----|--------|------------|------|
| Play route prefetch | ✓ | ✓ | ✓ | Hub idle 480ms |
| boot.ts chunk | ✓ | ✓ | ✓ | Idle + Start hover |
| Symbol PNGs | Core subset | Full 13 | Full 13 | Idle `prefetchPlayCoreByTier` |
| `preloadSymbolArt` decode | ✓ | ✓ | ✓ | Idle |
| Hidden WebGL warm (`deferBootstrap`) | hover/touch | hover/touch | hover/touch | Start gesture |
| AudioContext warmup | gesture | gesture | gesture | Start touch/hover |
| Session / Spin API | ✗ | ✗ | ✗ | Only ACTIVE `ensureBootstrap` |
| Heavy coin/particle FX | release on suspend | keep | keep | Suspend/resume |
| Win FX P2/P3 | lazy | lazy | lazy | During play wins |

Implementation: `client/xi-lobby/quality.ts` → `prefetchPlayCoreByTier`.

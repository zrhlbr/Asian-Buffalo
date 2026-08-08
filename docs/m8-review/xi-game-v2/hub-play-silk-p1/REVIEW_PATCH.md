# REVIEW_PATCH — Hub↔Play Silk P1

**Patch file:** `AB-XI-HUB-PLAY-SILK-P1-review.patch`  
**SHA-256:** see `SHA256.txt`  
**NO commit / push / merge / deploy** (per order)

## Summary of code changes

1. Persistent `XiGameHost` + lifecycle state machine (suspend/resume, no dispose on Hub↔Play)  
2. `bootM5({ deferBootstrap })` — warm WebGL without Session/Spin  
3. Hub idle/hover preload matrix + audio warmup  
4. Optimistic layer + sync DOM swap + Hub/Play chrome keep-alive  
5. Light trilingual loading overlay (>150ms)  
6. Perf trace marks; spin-safe leave preserved  

## Apply (local review only)

```bash
git apply docs/m8-review/xi-game-v2/hub-play-silk-p1/AB-XI-HUB-PLAY-SILK-P1-review.patch
```

(Working tree already contains these changes.)

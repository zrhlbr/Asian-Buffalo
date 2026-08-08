# PERFORMANCE_REPORT — Step 5

| Item | Result |
|------|--------|
| Headed FPS Android/iPhone | **NOT TESTED** (no device) |
| Long-session leak hunt (heap) | **NOT TESTED** |
| Duplicate WebGL renderer | CODE review — play-shell isolates navigation; no Step5 change to boot/renderer |
| Listener leaks in commerce panels | Minimal: useEffect fetch + unmount cancel patterns on lobby/hub already present; Step5 banner additive only |
| Duplicate deposit channel requests | Single fetch on panel mount |
| Symbol clarity tradeoff | **No change** — reel/symbol files not touched |

## Known prior evidence

Step 3 / M8 perf docs remain the commercial FPS baseline when re-validated on device. Step 5 did not claim new FPS numbers.

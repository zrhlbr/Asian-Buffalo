# Performance Impact — Clarity V2 (expected; device FPS not measured)

## Per tier

| Tier | Expected vs Phase3 | Notes |
|---|---|---|
| **high** | Similar or slightly cheaper post | Bloom strength↓ radius↓; exposure↓; composer DPR correctly matched (may *raise* post cost if previously under-buffered after LOD — correctness first) |
| **medium** | Similar | Same DPR cap 2; tighter bloom |
| **low** | Same Symbol cost; optional last-resort −8% buffer | `renderScale` floor **0.92** only after already on low; particles/shadows/bloom already cut first |

## What changed cost-wise

| Change | Fill / VRAM / CPU |
|---|---|
| Composer `setPixelRatio` sync | Correct buffers; avoids soft upscale; may increase post RT size when tier/DPR changes |
| Bloom tighter + win caps | **Lower** bloom cost / less overdraw wash |
| Exposure 1.02 | Neutral |
| Symbol plate still 1024 | Unchanged VRAM vs Phase3 (no fake 2048) |
| Lighter canvas wash | Negligible CPU on load |
| Sharp restore 0.15s | Negligible |
| Buffalo denser horn tubes | Tiny geometry↑ on hero only |
| Soft renderScale 0.92 | Last resort fill↓ ~15% area |

## Not measured

- Android / iPhone headed FPS — **not measured** (do not invent numbers)
- Continuous spin memory soak — not run this pack

## Principle check

- ✅ Degradation order: particles → grass → shadows → godRays → bloom → bg → **renderScale last**
- ✅ Low does **not** drop Symbol plate or force DPR 1
- ✅ Reel timing / direction unchanged

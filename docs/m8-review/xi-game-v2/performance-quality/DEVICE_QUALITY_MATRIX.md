# DEVICE_QUALITY_MATRIX

**Date:** 2026-08-07  
**Honesty:** Mapping is code-defined + unit-tested. Headed device rows are **SIMULATED** unless a real capture is attached.

## Caps → score → AUTO tier

| Profile | deviceMemory | cores | DPR | GPU class | FPS sample | Expected AUTO |
|---------|-------------|-------|-----|-----------|------------|---------------|
| Weak Android (SIMULATED) | ≤3 | ≤4 | ≥2.5 | Mali-T / Adreno 3xx / SwiftShader | &lt;30 | **LOW** |
| Mid-range phone (SIMULATED) | 4 | 6–8 | 2–3 | Adreno 6xx / Mali-G57 | 35–50 | **MEDIUM** (may HIGH if score≥72) |
| Flagship phone (SIMULATED) | ≥6 | ≥8 | 3 | Adreno 7xx / Apple GPU | ≥55 | **HIGH** (not ULTRA — mobile floor) |
| Mid desktop (SIMULATED) | 8 | 8 | 1–2 | discrete / modern iGPU | ≥48 | **HIGH** |
| Flagship desktop (SIMULATED) | ≥8 | ≥8 | ≤2 | RTX / modern discrete | ≥55 | **ULTRA** |

## Manual override

Settings: Auto / Low / Med / High / Ultra — persisted (`ab-m8-quality-settings`).  
AUTO runtime may step **down** only; manual Ultra on a weak phone is allowed but not recommended.

## Per-tier feature matrix

| Feature | LOW | MEDIUM | HIGH | ULTRA |
|---------|-----|--------|------|-------|
| DPR cap | 1.5 | 2 | 2.5 | 3 |
| Shadows | off | on 1024 | on 2048 | on 2048 |
| Bloom | off | on | on | on |
| God rays | off | off | on | on |
| Grass / clouds | minimal | mid | high | max |
| Coin / particle budget | 70 / 100 | 140 / 220 | 220 / 400 | 320 / 560 |
| Fur shells | 0 | 4 | 8 | 10 |
| Symbol anim intensity | 1 | 1 | 2 | 2 |
| Transition ms | 220 | 260 | 320 | 380 |
| Concurrent SFX | 4 | 6 | 8 | 8 |

## Soft last resort

Only when already **LOW** and FPS still poor: `renderScale = 0.92` (DEGRADE_ORDER last).

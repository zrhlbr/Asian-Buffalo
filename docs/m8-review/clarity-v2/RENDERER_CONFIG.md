# Renderer Config — Clarity V2 (before → after)

## WebGLRenderer

| Item | Before (Phase3) | After (V2) |
|---|---|---|
| antialias | always `true` | unchanged |
| powerPreference | `high-performance` | unchanged |
| High DPR cap | `min(dpr, 3)` | unchanged (`PIXEL_RATIO_CAPS.high = 3`) |
| Mid DPR cap | `min(dpr, 2)` | unchanged |
| Low DPR cap | `min(dpr, 2)` — never 1 | unchanged; Symbol/HUD protected |
| setSize | CSS via `#gl`; buffer = css × DPR | same + **`renderScale` last-resort multiply** |
| outputColorSpace | `SRGBColorSpace` | unchanged |
| toneMapping | `ACESFilmicToneMapping` | unchanged |
| toneMappingExposure idle | 1.05 | **1.02** (less wash, gold stays gold) |
| toneMappingExposure free-spin | 1.10 | **1.06** |
| shadowMap | PCFSoft; off on low | unchanged |
| maxTextureSize | not recorded | exposed via `World.getClarityProbe()` |

## EffectComposer / AA

| Item | Before | After |
|---|---|---|
| composer DPR sync | **bug:** `setSize` only — stale `_pixelRatio` after tier change | **`composer.setPixelRatio(renderer.getPixelRatio())` on every resize/applyQuality** |
| MSAA | on | on |
| FXAA / SMAA | none | none (avoid second soften) |
| OutputPass | yes | yes |

## Bloom / GodRays / DOF

| Item | Before | After |
|---|---|---|
| Bloom strength idle | 0.28 | **0.20** |
| Bloom radius | 0.55 | **0.40** |
| Bloom threshold | 0.88 | **0.92** |
| Free-spin bloom | 0.48 | **0.34** |
| Ultra win bloom | 0.78 | **0.42** |
| Jackpot bloom | 0.90 | **0.50** |
| FS trigger bloom | 0.60 | **0.36** |
| Post-win restore | 0.38 | **0.20** (matches idle) |
| GodRays | high only | unchanged |
| DOF | off | off |

## Render scale / degradation

| Item | Before | After |
|---|---|---|
| renderScale | implicit 1 | explicit: high/mid/low = **1.0**; soft-degrade last step can go **0.92** only on low |
| Degrade order | whole-tier drop | encoded `DEGRADE_ORDER`: particles → grass → shadows → godRays → bloom → bgComplexity → **renderScale last** |
| Symbol / HUD | kept on mid/low DPR≥2 | same; soft-degrade **never** lowers symbol plate or HUD CSS DPR |

## Probe helper

`World.getClarityProbe()` returns CSS size, drawing buffer, pixel ratio, renderScale, toneMappingExposure, bloom params, maxAnisotropy, maxTextureSize.

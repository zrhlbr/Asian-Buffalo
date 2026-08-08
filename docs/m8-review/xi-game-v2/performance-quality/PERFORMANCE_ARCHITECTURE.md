# PERFORMANCE_ARCHITECTURE — Xi Quality LOD (LOW/MEDIUM/HIGH/ULTRA)

**Date:** 2026-08-07  
**Branch:** `feature/ab-r1-m8-cursor`  
**Scope:** Presentation / asset / renderer LOD only

## Entry points (quality API)

| API | Location | Role |
|-----|----------|------|
| `detectInitialTier` / `detectInitialTierAsync` | `client/m5/quality.ts` | AUTO mapping from caps (+ optional FPS sample) |
| `scoreDevice` / `tierFromScore` / `collectDeviceCaps` | same | Pure scoring for tests + runtime |
| `profileFor` / `applySettingsToProfile` | same | Tier budgets + FX/animal overlay |
| `clarityPixelRatioFor` / `effectivePixelRatio` | same | DPR caps × soft renderScale |
| `readStoredQualitySettings` / `storeQualitySettings` | same | Persist mode/FX/animal/FPS |
| `FpsGovernor` | same | AUTO step-down (&lt;35 FPS ~3.8s), **no bounce-up** |
| `FramePacer` | same | Optional 30/60 FPS draw gate |
| `applyDocumentTierAttrs` | same | `data-xi-tier` / FX attrs for CSS |
| Lobby bridge | `client/xi-lobby/quality.ts` | Heroes, prefetch, document attrs |
| Boot wire | `client/m5/boot.ts` | Applies profile → World / Buffalo / Particles / Audio |
| Settings UI | `app/game-client.tsx` + `Hud` + lobby `QualitySettingsPanel` | Auto/Ultra/High/Med/Low + FX + animal + FPS |

## Pipeline

```
DeviceCaps (memory, cores, DPR, GPU, res, WebGL, FPS sample)
        │
        ▼
 scoreDevice → tierFromScore ──► AUTO ceiling
        │
 Settings (mode/FX/animal/FPS) ──► resolveTier / profileFor / applySettingsToProfile
        │
        ├─► World.applyQuality (DPR, shadows, bloom, god rays, fog)
        ├─► Particles budgets (pooled)
        ├─► Buffalo setFurShells + setAnimMode (never kill breath)
        ├─► Audio concurrent SFX + single AudioContext + background pause
        └─► document data-xi-tier (lobby/hub CSS FX)
                │
                ▼
        FpsGovernor (AUTO only): HIGH→MED→LOW if FPS<35 for ~3.8s
```

## Degradation order (locked)

`particles → shadows → godRays → bloom → bgComplexity → renderScale(last)`

Never first: Symbol plate / HUD / Reel sharpness.

## DPR caps

| Tier | Cap |
|------|-----|
| ULTRA | 3 |
| HIGH | 2.5 |
| MEDIUM | 2 |
| LOW | 1.5 |

## Default AUTO mapping (intent)

| Signal | Tier |
|--------|------|
| Weak mobile (mem≤3 or cores≤4 or weak GPU) | LOW (or MED if score≥48) |
| Mid phone | MEDIUM / HIGH |
| Strong desktop (mem≥8, cores≥8, WebGL2, FPS≥55) | ULTRA |

## Surface FX intensity

| Surface | LOW | MED | HIGH | ULTRA |
|---------|-----|-----|------|-------|
| Lobby particles | ~2 | ~4 | ~7 | 8 |
| Lobby rays/clouds | static / reduced | reduced rays | full | full |
| BDK hero embers/rays | opacity↓, no anim | medium | full | full |
| Slot postFX | bloom/godrays off | bloom on, rays off | both on | max budgets |
| Transitions | ~220ms | ~260ms | ~320ms | ~380ms |

## Non-goals

No Math/RTP/Wallet/Ledger/Round/Settlement/Admin business changes.  
`#gl { translateZ(0) }` kept; `#hud` shell translateZ not restored.

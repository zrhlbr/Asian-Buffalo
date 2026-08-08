# FILE_LIST — Performance Quality pack

**Date:** 2026-08-07  
**HEAD:** `1430df907ab33b8971a846cd3a013d7767aade3c` (branch `feature/ab-r1-m8-cursor`)  
**Note:** No commit created this session (per brief).

## Code (presentation)

| Path | Action |
|------|--------|
| `client/m5/quality.ts` | Extended — ULTRA, probe, settings, governor hysteresis, FramePacer |
| `client/m5/boot.ts` | Wire settings / pacer / audio pause / document attrs |
| `client/m5/scene/world.ts` | Shadows/DPR from enableShadows + shadowMapSize |
| `client/m5/scene/buffalo.ts` | `setAnimMode` simple/full |
| `client/m5/audio.ts` | Concurrent SFX + background pause/resume |
| `client/m5/ui/hud.ts` | FX / animal / FPS settings hooks |
| `client/m5/i18n.ts` | Quality strings trilingual |
| `client/m5/styles.css` | LOW transition timing |
| `app/game-client.tsx` | Settings modal controls |
| `client/xi-lobby/quality.ts` | **NEW** lobby bridge |
| `client/xi-lobby/quality-panel.tsx` | **NEW** settings + progressive hero |
| `client/xi-lobby/lobby-app.tsx` | Tier particles + settings + hero |
| `client/xi-lobby/bdk-hub.tsx` | Prefetch + hero + settings |
| `client/xi-lobby/lobby.css` | Tier FX CSS |
| `client/xi-lobby/i18n.ts` | Lobby quality strings |
| `scripts/gen-xi-hero-variants.mjs` | **NEW** asset generator |

## Assets

| Path | Action |
|------|--------|
| `public/xi/heroes/journey-*.webp` / `.avif` | Generated |
| `public/xi/heroes/bdk-*.webp` / `.avif` | Generated |
| `public/xi/journey-hero.png` | Source (unchanged) |
| `public/xi/heroes/bull-demon-king.png` | Source (unchanged) |

## Tests

| Path | Action |
|------|--------|
| `tests/xi-performance-quality.test.mjs` | **NEW** |
| `tests/r1-m8-clarity-v2.test.mjs` | Aligned to 4-tier DPR / degrade |
| `tests/r1-m8-clarity.test.mjs` | Aligned caps |
| `tests/r1-m6-presentation.test.mjs` | Governor sustain opts + ultra |

## Docs (this folder)

- `MODULE_IMPACT_ANALYSIS.md`
- `PERFORMANCE_ARCHITECTURE.md`
- `DEVICE_QUALITY_MATRIX.md`
- `ASSET_OPTIMIZATION_REPORT.md`
- `FPS_REPORT.md`
- `MEMORY_REPORT.md`
- `MOBILE_FALLBACK_REPORT.md`
- `I18N_REPORT.md`
- `REGRESSION_REPORT.md`
- `BLOCKED_CAPTURE.md`
- `REVIEW_PATCH.md` / `REVIEW_PATCH.patch`
- `SHA256.txt`
- `FILE_LIST.md`
- `GIT_STATUS.txt`
- `screenshots/` (empty — blocked)

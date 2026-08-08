# Lobby V3 — PERFORMANCE_REPORT

**Mode:** SIMULATED (code-path / CSS tier audit). Headed FPS not measured this run.

## Tier FX matrix (lobby hero)

| Tier | Clouds | Sun breath | Rays | Spirit dots | Blur / canvas |
|------|--------|------------|------|-------------|----------------|
| LOW | static | static | near-off | 0 | none |
| MED | light 5–8s CSS | 7s CSS | off / tiny static | 0 | none |
| HIGH | 6.5s CSS | 6.5s CSS | slow rotate | 4 | none |
| ULTRA | 6.5s CSS | 6.5s CSS | slow rotate | 6 | none |
| FX off | static low opacity | static | hidden | 0 | none |

`particleCountForTier`: low/med → 0; high → 4; ultra → 6. No heavy particles, no blur spam, no extra canvas.

## Other LOD

| Feature | Rule |
|---------|------|
| HOT glow pulse | HIGH/ULTRA only; LOW/MED `animation: none` |
| VIP / wallet breath | HIGH/ULTRA only |
| Wallet number | tabular-nums; no heavy roll anim on LOW/MED |
| Backdrop-filter | Already stripped on LOW/MED topbar/nav |
| Nav busy | Pause cloud/particle anims on LOW/MED |

## Assets

- Journey hero: progressive WebP/AVIF 720/1080/1440 via `heroSrcSet` / `heroAvifSrcSet`
- Rec card BDK: eager `bdk-mobile.webp`; other cards CSS art / lazy when images exist
- Phone band prefers mobile/low — desktop 1440 not forced on 320–430 (`sizes` + srcset)

## SIMULATED notes (320–430)

- Expected: CSS transform/opacity only for ambient FX → low main-thread cost vs canvas particles
- Expected: fewer DOM particles vs prior (cranes removed; max 6 dots)
- Risk: Google Fonts `@import` still in `lobby.css` (pre-existing) — not introduced by V3
- Unblock for real FPS: headed Chrome Performance on mid phone at HIGH vs LOW

## Claims

Commercial FPS claims require headed device evidence — **not claimed PASS** here.

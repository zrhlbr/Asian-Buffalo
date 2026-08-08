# Lobby V3 — ASSET_REPORT

## Journey hero (kept)

| Asset | Role |
|-------|------|
| `/xi/heroes/journey-low.webp` (+avif) | LOW / narrow |
| `/xi/heroes/journey-mobile.webp` (+avif) | ~720w |
| `/xi/heroes/journey-tablet.webp` (+avif) | ~1080w |
| `/xi/heroes/journey-desktop.webp` (+avif) | ~1440w |
| `/xi/journey-hero.png` | fallback |

Wired via `quality.ts` `heroSources` / `heroSrcSet` / `heroAvifSrcSet` / `heroSizes` — **unchanged ladder**, presentation FX only.

## Recommended

| Card | Image |
|------|-------|
| BDK (eager) | `/xi/heroes/bdk-mobile.webp` |
| Dragon / Phoenix / Wealth / Panda | CSS art motifs (no fake photo); lazy when `imageSrc` set |

## Rules honored

- No 4K master forced on phone (srcset + sizes)
- Lazy non-first rec images (`loading={index===0?"eager":"lazy"}`)
- No new third-party / African Buffalo art
- No fake jackpot art overlays

## Generation

No new raster masters generated this package. Existing P2 WebP/AVIF set reused.

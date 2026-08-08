# ASSET_OPTIMIZATION_REPORT

**Date:** 2026-08-07  
**Rule:** Do not invent binary 4K masters — scale from existing Journey / BDK heroes only.

## Source masters

| Asset | Path | Native size | Format notes |
|-------|------|-------------|--------------|
| Journey hero | `public/xi/journey-hero.png` | 682×312 | PNG |
| BDK hero | `public/xi/heroes/bull-demon-king.png` | 1024×768 | JPEG bytes with `.png` extension |

## Generated variants (sharp)

Script: `scripts/gen-xi-hero-variants.mjs`

| Output | Width | WebP | AVIF |
|--------|-------|------|------|
| `journey-low` | 320 | ~10 KB | ~8 KB |
| `journey-mobile` | 480 | ~26 KB | ~24 KB |
| `journey-tablet` / `desktop` | 682 | ~47 KB | ~43 KB |
| `bdk-low` | 480 | ~29 KB | ~23 KB |
| `bdk-mobile` | 640 | ~61 KB | ~56 KB |
| `bdk-tablet` | 960 | ~112 KB | ~99 KB |
| `bdk-desktop` | 1024 | ~128 KB | ~116 KB |

## Runtime strategy

1. **Progressive:** low WebP first → upgrade to srcset WebP + PNG/JPEG fallback (`ProgressiveHeroImage`)
2. **Responsive:** `srcSet` 480w / 960w / 1400w + `sizes`
3. **Lazy routes:** lobby first; hub hero prefetch on hub enter; slot boot prefetch on **Start Game**
4. **Prefer WebP/AVIF:** `<source type="image/avif">` then WebP then PNG/JPEG fallback

## Not done / honesty

- No new photographic masters created
- Symbol plates remain existing 1024 PNG pipeline (Clarity V2) — out of hero scope

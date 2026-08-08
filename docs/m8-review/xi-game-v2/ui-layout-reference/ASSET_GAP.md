# ASSET_GAP — UI Layout V2 / Heroes

**Date:** 2026-08-07  
**Module:** Presentation only (xi-lobby)

---

## Cleared

| Asset | Status | Public URL path | Notes |
|-------|--------|-----------------|-------|
| **牛魔王 BDK hero** (Zhao official) | **CLEARED** | `/xi/heroes/bull-demon-king.png` | Wired on `/xi/bull-demon-king` as full hero plate (`object-fit: contain`, no crop of main figure, no stretch). Also mirrored at `client/xi-lobby/assets/heroes/bull-demon-king.png`. |
| Journey lobby hero (cropped from Zhao lobby layout reference) | **CLEARED for layout V2** | `/xi/journey-hero.png` | Used on `/xi` full hero. Source layout ref: `/xi/lobby-layout-reference.png`. |

---

## Remaining (optional / non-blocking)

| Asset | Status | Notes |
|-------|--------|-------|
| Recommended game card art (龙王/凤凰/财神/武林熊猫) | OPEN | Gradient placeholders only; titles/JACKPOT lines live |
| USDT live balance | OPEN | Contract pending — chip shows unavailable + plus → deposit |
| Dedicated Journey painting separate from lobby mockup crop | OPTIONAL | Current crop preserves pilgrims; upgrade if Zhao provides standalone plate |

---

## Hub wiring

- File: `client/xi-lobby/bdk-hub.tsx`
- Element: `[data-testid="xi-hub-hero-img"]` → `src="/xi/heroes/bull-demon-king.png"`
- ASSET_GAP badge removed from hub UI
- CSS procedural figure layers demoted to ambient magma wash only

# ASSET_GAP — Phase 1 Hero Banner

**Status:** MISSING  
**Searched (workspace):** `public/`, `docs/`, `client/**/assets/`, `uploads/` (none), filenames matching 西游 / 西天 / Journey / xiyou / 西游戏 / zhao / hero / banner.

**Result:** No Zhao-provided Journey to the West / 西游记 / 西天取经 HD hero image found in this workspace.

**Mitigation shipped:** CSS full-bleed placeholder hero on `/xi` with:
- dusk/gold/vermilion gradient (not African Buffalo art)
- slow cloud drift, sun glow, light particles, subtle camera breath
- i18n label `lobby.hero.placeholder`
- `prefers-reduced-motion` disables FX

**IP:** Did not scrape or reuse African Buffalo proprietary art.

**Ask Zhao:** Drop licensed/original Journey HD still under e.g. `public/xi/hero-journey.webp` and set `platform.heroAsset` to `"provided"` in lobby catalog.

# ASSET_GAP — Mythic Visual Unification

## Journey / 西天取经 hero (Page 1)

| Item | Status |
|------|--------|
| Zhao-provided HD Journey-to-the-West / 西天取经 hero | **MISSING** |
| Search paths | `public/`, `docs/`, `client/**/assets/`, `uploads/` |
| Matches | None (only `public/avatars/*` + `favicon.svg`) |

**Mitigation shipped:** Cinematic CSS layers on `/xi` — cloud sea, god rays, distant mountains, palace silhouette, crane dots, gold spirit particles, mist. Label via `lobby.hero.placeholder` + `lobby.hero.journey`.

**Ask Zhao:** Drop licensed/original still at e.g. `public/xi/hero-journey.webp` and wire as optional hero background without removing procedural layers as fallback.

## BDK hub figure / ambient media (Page 2)

| Item | Status |
|------|--------|
| Painted BDK hero character art | **MISSING** — CSS silhouette figure used |
| Licensed drum / fire / thunder / breath loops | **MISSING** — procedural WebAudio stubs layered sparsely |
| Flame Mountain plate / weapon metal FOOTAGE | **MISSING** — CSS/canvas-lite gradients |

**IP:** No African Buffalo (or any third-party) art/audio scraped.

## Slot symbol chrome (Page 3)

| Item | Status |
|------|--------|
| Dedicated jingubang Wild plate / palace Scatter plate | **MISSING** — motif hints via life accents + existing art IDs unchanged |
| Commercial win SFX banks for cloud/lotus/gate | **GAP** — existing procedural cues retained; CSS metaphor overlays added |

## Fonts

Display calligraphy font loads from Google Fonts CDN (`ZCOOL XiaoWei`). If offline CDN blocked, falls back to Noto Serif SC / Georgia. Body remains Noto Sans stacks for zh/my/en.

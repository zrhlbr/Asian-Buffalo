# Clarity V2 — exact changed files

## Presentation / client

| Path | Role |
|---|---|
| `client/m5/quality.ts` | DPR caps, renderScale, DEGRADE_ORDER, soft-scale governor |
| `client/m5/scene/world.ts` | Composer DPR sync, bloom/exposure, clarity probe |
| `client/m5/game/symbols.ts` | Native 1024 plate, lighter wash/AO/rim, expectations export |
| `client/m5/game/reels.ts` | Pixel-align helpers, sharp restore, stretch tune |
| `client/m5/game/symbol-life.ts` | Softer UV/sheen; spinning 0..1 fade |
| `client/m5/game/game.ts` | Win bloom caps (no 0.78/0.9 wash) |
| `client/m5/boot.ts` | Soft renderScale wiring + clarity probe in debug state |
| `client/m5/styles.css` | HUD/font sharpness; reduced glow shadows |
| `client/m5/scene/buffalo.ts` | Eyes/catchlight, wet nose, denser horns |

## Tests

| Path | Role |
|---|---|
| `tests/r1-m8-clarity-v2.test.mjs` | **new** V2 contracts |
| `tests/r1-m8-clarity.test.mjs` | Phase3 assertions updated for PIXEL_RATIO_CAPS |

## Docs (this pack)

| Path |
|---|
| `docs/m8-review/clarity-v2/CLARITY_AUDIT.md` |
| `docs/m8-review/clarity-v2/RENDERER_CONFIG.md` |
| `docs/m8-review/clarity-v2/TEXTURE_AUDIT.md` |
| `docs/m8-review/clarity-v2/ASSET_SOURCE_LIMITATION.md` |
| `docs/m8-review/clarity-v2/PERFORMANCE_IMPACT.md` |
| `docs/m8-review/clarity-v2/REVIEW_PATCH.md` |
| `docs/m8-review/clarity-v2/SHA256.txt` |
| `docs/m8-review/clarity-v2/FILE_LIST.md` |
| `docs/m8-review/clarity-v2/TEST_RESULTS.md` |
| `docs/m8-review/clarity-v2/BLOCKED_CAPTURE.md` |
| `docs/m8-review/clarity-v2/_capture-v2.mjs` |
| `docs/m8-review/clarity-v2/_measure-textures.mjs` |

## Explicitly untouched

Wallet, Ledger, RTP, Math, Grid, RNG, Paytable, Session, Round, Settlement, formal API, Provider, Recovery, Database, Admin, reel-timing constants (`1.35`, ~10s stops), reel direction.

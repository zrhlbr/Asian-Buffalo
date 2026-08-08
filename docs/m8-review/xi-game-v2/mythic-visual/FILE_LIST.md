# Mythic Visual Unification — FILE_LIST

## Code (whitelist)

| File | Page | Role |
|------|------|------|
| `client/xi-lobby/lobby-app.tsx` | 1 | Hero layers, jade tablet, feature motifs |
| `client/xi-lobby/lobby.css` | 1–2 | Immortal qi + BDK hub scene CSS |
| `client/xi-lobby/i18n.ts` | 1–2 | New trilingual keys |
| `client/xi-lobby/bdk-hub.tsx` | 2 | Layered hub + decree CTA + ambient |
| `app/game-client.tsx` | 3 | Mythic chrome DOM + win accents |
| `client/m5/styles.css` | 3 | Edge chrome / HUD tint / win FX CSS |
| `client/m5/win-presentation.ts` | 3 | particleStyle mythic mapping only |
| `client/m5/scene/world.ts` | 3 | Sky dusk wash + distant lightning |
| `client/m5/game/symbol-life.ts` | 3 | Wild/Scatter motif comments (IDs unchanged) |
| `client/m5/i18n.ts` | 3 | Loading string Flame Mountain (zh/en/my) |

## Docs (this folder)

- `MODULE_IMPACT_ANALYSIS.md`
- `FILE_LIST.md`
- `REVIEW_PATCH.md`
- `SHA256.txt`
- `REGRESSION_PAGE1.md` / `REGRESSION_PAGE2.md` / `REGRESSION_PAGE3.md`
- `BEFORE_AFTER.md`
- `ASSET_GAP.md`
- `RISK.md`
- `ROLLBACK.md`
- `BLOCKED_CAPTURE.md` (if headed capture unavailable)
- `screenshots/` (when capture succeeds)

## Explicitly untouched

- Spin / Wallet / Ledger / Math / RTP / Round / Session / API contracts / DB
- Admin core modules
- `client/m5/game/reel-timing.ts`, reel layout/fill
- `#gl` / `#hud` stacking contract (`#gl` translateZ kept; `#hud` shell translateZ NOT restored)
- Symbol IDs / paytable values

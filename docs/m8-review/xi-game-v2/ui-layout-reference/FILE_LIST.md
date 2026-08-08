# FILE_LIST — UI Layout V2 + BDK hero

## Code (whitelist)

| Path | Role |
|------|------|
| `client/xi-lobby/lobby-app.tsx` | Lobby layout match Zhao reference |
| `client/xi-lobby/bdk-hub.tsx` | Hub chrome + official BDK hero `<img>` |
| `client/xi-lobby/play-shell.tsx` | Shell only (no spin/math) |
| `client/xi-lobby/lobby.css` | Layout V2 + BDK hero photo styles |
| `client/xi-lobby/i18n.ts` | Trilingual strings |
| `client/xi-lobby/api.ts` | Read `playerId` for ID display only |

## Assets

| Path | Public URL |
|------|------------|
| `public/xi/heroes/bull-demon-king.png` | `/xi/heroes/bull-demon-king.png` |
| `public/xi/journey-hero.png` | `/xi/journey-hero.png` |
| `public/xi/lobby-layout-reference.png` | `/xi/lobby-layout-reference.png` |
| `client/xi-lobby/assets/heroes/bull-demon-king.png` | (mirror) |
| `client/xi-lobby/assets/journey-hero.png` | (mirror) |
| `client/xi-lobby/assets/lobby-layout-reference.png` | (mirror) |

## Delivery docs (this folder)

- MODULE_IMPACT.md
- LAYOUT_DIFF_CHECKLIST.md
- FILE_LIST.md
- ASSET_GAP.md
- I18N_REPORT.md
- REGRESSION.md
- REVIEW_PATCH.md
- SHA256.txt
- AB-XI-UI-LAYOUT-V2-review.patch
- screenshots/*
- `_smoke-layout.mjs` / smoke-results.json

## Untouched (forbidden)

- `client/m5/game/*` reel/spin
- Wallet/Ledger/Math/RTP/Admin business

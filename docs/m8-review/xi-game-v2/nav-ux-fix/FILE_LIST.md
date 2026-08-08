# Nav UX Fix — FILE_LIST

## Code (whitelist)

| Path | Role |
|------|------|
| `client/xi-lobby/nav.ts` | **NEW** — transitions, edge swipe, ESC, layer helpers |
| `client/xi-lobby/bdk-hub.tsx` | Hub back button, breadcrumb, swipe/ESC, hub↔lobby/play navigate |
| `client/xi-lobby/play-shell.tsx` | Play back + home + breadcrumb; safe-leave; swipe/ESC |
| `client/xi-lobby/lobby-app.tsx` | Lobby→hub slide-left navigate; enter transition; **no** back |
| `client/xi-lobby/lobby.css` | Nav chrome + transition CSS (no `#gl`/`#hud` shell transform) |
| `client/xi-lobby/i18n.ts` | Additive nav/breadcrumb keys zh/my/en |

## Delivery (`docs/m8-review/xi-game-v2/nav-ux-fix/`)

| Path | Role |
|------|------|
| `MODULE_IMPACT_ANALYSIS.md` | Pre-code impact (Dev Rules V2.0) |
| `NAV_E2E.md` | E2E gate report |
| `I18N.md` | Nav i18n matrix |
| `FILE_LIST.md` | This file |
| `REVIEW_PATCH.md` | Patch summary |
| `AB-XI-NAV-UX-FIX-review.patch` | Review patch |
| `SHA256SUMS.txt` | Hashes |
| `ACCEPTANCE.md` | Checklist vs §验收 |
| `_smoke-nav.mjs` | Playwright smoke |
| `smoke-results.json` | Machine results |
| `screenshots/*` | Evidence shots |

## Forbidden (untouched)

- Wallet / Reel / Spin / Math / RTP / Settlement / Ledger / Admin
- `#gl { transform: translateZ(0) }` preserved; `#hud` shell **no** translateZ
- No commit / push

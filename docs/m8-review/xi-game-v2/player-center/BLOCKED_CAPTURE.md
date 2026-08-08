# BLOCKED_CAPTURE — Player Center screenshots

**Date:** 2026-08-08  
**Status:** BLOCKED

## Reason

No local Vite/Next dev server was running in this session (terminals empty). Browser MCP had zero open tabs. Starting a full stack for headed capture would require env/secrets and is out of scope for this package (no deploy).

## Intended captures (when unblocked)

| Shot | Viewport | Steps |
|------|----------|-------|
| `01-me-phone-390.png` | 390×844 | `/xi` → tap `xi-nav-me` → `xi-player-center` |
| `02-me-wallet-sheet.png` | 390×844 | tap ledger → WalletPanel sheet |
| `03-me-security.png` | 390×844 | open security center reserved list |
| `04-me-lang-en.png` | 390×844 | switch lang via `xi-pc-lang-en` (no reload) |
| `05-lobby-home-regression.png` | 390×844 | `xi-nav-home` — Hero/rec/quick unchanged |

## Unblock steps

1. `npm run dev` (or project-standard local start) with valid `.dev.vars`  
2. Open `/xi` headed  
3. Capture table above into `docs/m8-review/xi-game-v2/player-center/screenshots/`  
4. Replace this note with screenshot index

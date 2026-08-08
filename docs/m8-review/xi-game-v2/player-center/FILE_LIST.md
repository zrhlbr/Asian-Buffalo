# Player Center — FILE_LIST

## Code (allowed)

| Path | Action |
|------|--------|
| `client/xi-lobby/player-center.tsx` | NEW |
| `client/xi-lobby/player-center.css` | NEW |
| `client/xi-lobby/lobby-app.tsx` | MODIFY (Me tab wire only) |
| `client/xi-lobby/i18n.ts` | MODIFY (`lobby.me.*` zh/en/my) |

## Docs (this package)

| Path | Action |
|------|--------|
| `docs/m8-review/xi-game-v2/player-center/MODULE_IMPACT_ANALYSIS.md` | NEW (before code) |
| `docs/m8-review/xi-game-v2/player-center/MODULE_IMPACT.md` | NEW (alias) |
| `docs/m8-review/xi-game-v2/player-center/PLAYER_CENTER_DELIVERY.md` | NEW |
| `docs/m8-review/xi-game-v2/player-center/PLAYER_CENTER_UI_REPORT.md` | NEW |
| `docs/m8-review/xi-game-v2/player-center/I18N_REPORT.md` | NEW |
| `docs/m8-review/xi-game-v2/player-center/RESPONSIVE_REPORT.md` | NEW |
| `docs/m8-review/xi-game-v2/player-center/REGRESSION_REPORT.md` | NEW |
| `docs/m8-review/xi-game-v2/player-center/FILE_LIST.md` | NEW |
| `docs/m8-review/xi-game-v2/player-center/REVIEW_PATCH.md` | NEW |
| `docs/m8-review/xi-game-v2/player-center/SHA256.txt` | NEW |
| `docs/m8-review/xi-game-v2/player-center/BLOCKED_CAPTURE.md` | NEW |
| `docs/m8-review/xi-game-v2/player-center/GIT_STATUS_NOTE.txt` | NEW |
| `docs/m8-review/xi-game-v2/player-center/AB-XI-PLAYER-CENTER-review.patch` | NEW (UTF-8 file snapshot patch) |

## Explicitly NOT modified

- `client/xi-lobby/bdk-hub.tsx`, `play-shell.tsx`, `game-host.tsx`, `game-lifecycle.ts`, `layer-keepalive.tsx`, `xi-shell.tsx`, `nav.ts` (logic), `auth-api.ts`, `api.ts` business
- `client/m5/**`
- `app/admin/**`
- DB / migrations

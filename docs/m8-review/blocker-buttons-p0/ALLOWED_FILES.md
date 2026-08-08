# ALLOWED_FILES — P0 Button Restore (Phase 1)

Declared scope before edit. Stay inside unless root cause proven elsewhere.

## Prefer (declared)

| Path | Role |
|---|---|
| `client/m5/ui/hud.ts` | Button listeners, overlay dismiss, celebrate finally |
| `client/m5/styles.css` | `pointer-events` / z-index / loading trap |
| `client/m5/boot.ts` | Loading dismiss failsafe |
| `client/m5/game/game.ts` | Busy finally (stuck Spin/Bet lock) |
| `client/m5/i18n.ts` | `back` label only |
| `app/game-client.tsx` | `#btn-back` DOM (required for Back restore) |

## Explicitly out of scope (untouched)

- Wallet / Ledger / Math / Admin / API contracts
- Round / Session settlement cores
- Reel ShaderMaterial path / symbol atlas
- New gameplay features

## Phase 2 (separate pack)

Only after Phase 1 pass — see `docs/m8-review/animal-life-amplitude/`.

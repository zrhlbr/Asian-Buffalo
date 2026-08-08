# Step 2 — FILE_LIST

## Whitelist code (this module)

| Path | Role |
|------|------|
| `app/xi/bull-demon-king/page.tsx` | Hub route mounts `BdkHub` |
| `app/xi/bull-demon-king/layout.tsx` | Hub metadata / layout |
| `app/xi/bull-demon-king/play/page.tsx` | Minimal play passthrough route |
| `client/xi-lobby/bdk-hub.tsx` | Full BDK hub UI |
| `client/xi-lobby/play-shell.tsx` | Minimal GameClient mount + back |
| `client/xi-lobby/i18n.ts` | Trilingual hub keys |
| `client/xi-lobby/api.ts` | Read-only `fetchVip` (+ existing helpers) |
| `client/xi-lobby/lobby.css` | Hub FX / groups / CTA styles |

## Reused unchanged (not redesigned)

| Path | Role |
|------|------|
| `app/game-client.tsx` | Existing slot shell mounted by play passthrough |
| `client/xi-lobby/lobby-app.tsx` | Lobby (regression only) |
| `lib/lobby-catalog.ts` | `href: /xi/bull-demon-king` already correct |
| `app/xi/bdk/page.tsx` | Legacy redirect → hub |

## Explicitly NOT developed (Step 3)

- Reel / HUD / FX redesign
- Animal animation / Jackpot math
- Wallet / Ledger / Session / Spin / Round core changes
- Admin / DB history modules

## Delivery package

`docs/m8-review/xi-game-v2/step-2-bdk-hub/**` (this folder)

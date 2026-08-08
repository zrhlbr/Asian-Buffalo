# Wallet Center — FILE_LIST

## Changed / added (this stage)

| Path | Role |
|------|------|
| `client/xi-lobby/wallet-center.tsx` | NEW — Wallet Center module |
| `client/xi-lobby/wallet-center.css` | NEW — scoped mythic styles |
| `client/xi-lobby/lobby-app.tsx` | Minimal — wallet tab → `WalletCenter` |
| `client/xi-lobby/i18n.ts` | `lobby.wc.*` keys zh / en / my-MM |
| `docs/m8-review/xi-game-v2/wallet-center/**` | Delivery package |

## Import-only (not edited)

| Path |
|------|
| `client/xi-lobby/api.ts` |
| `client/xi-lobby/commerce-panels.tsx` |

## Explicitly untouched

| Path |
|------|
| `client/xi-lobby/player-center.tsx` |
| `client/xi-lobby/player-center.css` |
| `client/xi-lobby/bdk-hub.tsx` |
| `client/xi-lobby/play-shell.tsx` |
| `client/xi-lobby/layer-keepalive.tsx` |
| `client/m5/**` |
| `app/admin/**` |
| Wallet/ledger API business routes (rules unchanged) |

## Patch

`AB-XI-WALLET-CENTER-review.patch` (4 file diffs: wallet-center.tsx/css, lobby-app.tsx, i18n.ts)

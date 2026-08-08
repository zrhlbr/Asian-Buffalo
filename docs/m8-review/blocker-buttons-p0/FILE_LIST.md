# FILE_LIST — actual Phase 1 touches

| File | Change |
|---|---|
| `client/m5/styles.css` | Canvas PE none + z-index; HUD z-index; selective PE; loading.done harden |
| `client/m5/ui/hud.ts` | `releasePointerTraps`, celebrate finally, `#btn-back` wiring |
| `client/m5/game/game.ts` | Spin `try/finally` busy clear; trap release on presentation error |
| `client/m5/boot.ts` | Loading dismiss failsafe timeout |
| `client/m5/i18n.ts` | `back` string (zh/en/my) |
| `app/game-client.tsx` | `#btn-back` button in top actions |

## Not touched

Wallet, Ledger, Math, Admin, API routes, `formal-provider.ts`, reel material path.

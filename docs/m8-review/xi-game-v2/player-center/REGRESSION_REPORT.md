# Player Center Regression Report

## Code-path verification

| Area | Result | Evidence |
|------|--------|----------|
| Lobby home Hero / recommended / quick | **PASS** | Unchanged JSX blocks; Me tab only swapped |
| Bottom nav order / ids | **PASS** | Same `home/games/wallet/activity/me` map |
| Hub (`bdk-hub.tsx`) | **PASS** | Not edited |
| Play / reel / spin / math | **PASS** | `client/m5/**` not edited |
| Topbar wallet / VIP / lang / auth | **PASS** | Unchanged; Me reuses same callbacks |
| Wallet business / ledger rules | **PASS** | Display + existing `WalletPanel` only |
| Auth core | **PASS** | `authLogout` / forgot route only |
| Admin / DB | **PASS** | Not touched |
| i18n parity | **PASS** | `assertLobbyI18nComplete` ok |
| Hydration lang pattern | **PASS** | Existing store; Me uses `saveLobbyLang` |

## Risk residual

- Headed visual regression not captured (server absent).  
- USDT remains unavailable until API `usdtSupported` — intentional honesty.

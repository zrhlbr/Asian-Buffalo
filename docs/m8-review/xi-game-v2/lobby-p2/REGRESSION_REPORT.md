# REGRESSION_REPORT — Lobby P2

## Must PASS

| Gate | Status | Class |
|------|--------|-------|
| `/xi` lobby loads (code path intact) | PASS | CODE |
| Hub files not edited | PASS | PATH |
| Play / GameClient keep-alive not edited | PASS | PATH |
| hydration-safe lang / quality stores unchanged pattern | PASS | CODE |
| Fake winners / fake jackpot removed | PASS | CODE |
| `#gl` translateZ kept; no `#hud` shell translateZ | PASS | CSS |
| Wallet display still server-fetched | PASS | CODE |
| i18n parity | PASS | REAL assert |
| Headed visual Hub↔Play warm nav | BLOCKED | See BLOCKED_CAPTURE |
| hydration=0 / black=0 headed proof | BLOCKED | See BLOCKED_CAPTURE |

## Untouched warm-nav stack (explicit)

- `client/xi-lobby/xi-shell.tsx`
- `client/xi-lobby/game-host.tsx`
- `client/xi-lobby/layer-keepalive.tsx`
- `client/xi-lobby/game-lifecycle.ts`
- `client/xi-lobby/nav.ts`
- `client/xi-lobby/play-shell.tsx`
- `client/xi-lobby/bdk-hub.tsx`

## Forbidden domains not touched

Reel / Spin / RNG / RTP / Math / Round / Settlement / Wallet-Ledger business / Deposit-Withdrawal settlement / VIP business core / Admin.

## Pre-existing out-of-scope tsc

`client/xi-lobby/game-lifecycle.ts(97)` ACTIVE comparison — **not modified** (forbidden warm-nav file).

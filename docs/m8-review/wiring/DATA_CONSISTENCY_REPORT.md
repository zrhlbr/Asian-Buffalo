# DATA CONSISTENCY REPORT

## Intended single source of truth

| Domain | Source of truth | Consumer |
|---|---|---|
| Spin outcome / grid | `game_rounds.outcome_json` (server RNG) | Player reel + Admin rounds |
| Balance | `ledger_accounts` / `ledger_balances` PLAYER_AVAILABLE | Player balance API + Admin ledger |
| Wallet lifecycle | `wallet_intents` + `wallet_provider_ops` | Admin wallet RO |
| Settlement link | `ledger_transactions.round_id` + intent `idempotency_key` = round key | Round detail deep link |
| Math | `game_math_versions` FROZEN | Rules + spins |
| Announcements | `admin_announcements` PUBLISHED + schedule JSON | Admin create → Player GET |

## Evidence (automated)

From `r1-m8-wiring-d1-money.test.mjs` after one settle (bet 50, win 20, seed 100000):

- `wallet_intents.status = SUCCESS`, `ledger_tx_id` set
- `ledger_transactions.idempotency_key = ledger:wire-spin-1`, `round_id = round_wire_1`, `status = POSTED`
- `ledger_accounts` PLAYER_AVAILABLE balance = **99970**
- Matches `RoundSettlement.playerBalanceAfterMinor`

Admin `getRoundDetail` joins ledger by `round_id` and wallet intent by `(player_id, idempotency_key)` — both satisfied by the formal settle path.

## Prior gap (fixed)

Live spin/balance routes previously used in-memory `TestWalletAdapter`, so Admin Wallet/Ledger SQL saw empty tables while HUD showed a balance. **Fixed:** routes now use `createRouteDbWalletAdapter(db)`.

## Residual

Headed cross-app (game UI + admin UI) against Miniflare D1 not captured in this session — see `E2E_REPORT.md` / `BLOCKED_CAPTURE.md`.

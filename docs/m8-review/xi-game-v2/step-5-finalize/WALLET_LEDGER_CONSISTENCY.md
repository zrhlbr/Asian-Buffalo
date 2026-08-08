# WALLET_LEDGER_CONSISTENCY — Step 5

## Identity of balances (3 pages)

| Page | Source | Field |
|------|--------|-------|
| Lobby top meter | `GET /api/v1/game/wallet/balance` | `balanceMinor` (= available) |
| Hub top meter | same | same |
| Play HUD | formal provider → same balance API | same |
| Wallet panel | `GET /api/v1/game/wallet` | `availableMinor` + `frozenMinor` |

**Rule:** Client never writes balances. After deposit confirm / withdraw / VIP reward / check-in / activity / spin settlement → refresh from server.

## Closed-loop evidence (automated)

| Path | Result | Test |
|------|--------|------|
| Deposit create → confirm → single credit | PASS | `deposit-withdraw.test.mjs` |
| Deposit double confirm idempotent | PASS | alreadyCredited, balance unchanged |
| Withdraw hold freeze | PASS | available↓ frozen↑ |
| Withdraw reject unfreeze | PASS | balance restored |
| Withdraw approve → pay | PASS | stays debited, PAID |
| Anti-overdraw | PASS | INSUFFICIENT_BALANCE |
| VIP reward credit once | PASS | `vip-rewards.test.mjs` |
| Activity / check-in idempotent | PASS | `activity-checkin.test.mjs` |
| Snapshot recent moves | PASS | `step4-wallet-vip.test.mjs` |

## Concurrency / refresh mid-process

| Case | Status |
|------|--------|
| Same idempotencyKey deposit create | PASS (alreadyExists) |
| Concurrent confirm same order | PASS (second alreadyCredited) |
| Refresh balance mid PENDING deposit | CODE — returns available unchanged until SUCCESS |
| Refresh mid open withdraw | PASS — frozen reflected |

## Invariants preserved

- No raw `UPDATE players SET balance`
- MoneyService intent idempotency keys unique per credit/debit
- Ledger RO admin health still flags unbalanced txs (existing M7 test)

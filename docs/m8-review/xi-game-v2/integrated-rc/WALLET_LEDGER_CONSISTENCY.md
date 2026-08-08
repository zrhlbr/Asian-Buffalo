# WALLET_LEDGER_CONSISTENCY — Integrated RC

## Single ledger projection

All three player surfaces (lobby / hub / play) + admin finance views read **server** balances. No client-authored balance writes.

| Event | Expected |
|-------|----------|
| Spin settle | available updates via MoneyService / DbWalletAdapter |
| Deposit confirm (test harness) | credit once; double confirm idempotent |
| Withdraw create | available↓ frozen↑ hold |
| VIP / activity / check-in | MoneyService credit with idempotency keys |

## Phase C same-player evidence (`dev-test-player`)

From `smoke-results.json`:

1. Balance before spin observed
2. Session → Spin → Round SETTLED (`playerId` matched)
3. Balance after spin decreased by bet (roomBase 50 × level 1 × mult 1)
4. Wins history includes new round
5. Deposit create → confirm SUCCESS (NOT_PRODUCTION_READY readiness preserved)
6. Withdraw create hold SUCCESS (minMinor from config)
7. Admin deposits/withdrawals list 200 for same commerce trail

## Unit closed-loop (still green)

`deposit-withdraw.test.mjs`, `vip-rewards.test.mjs`, `activity-checkin.test.mjs`, `step4-wallet-vip.test.mjs`, `r1-m4-money.test.mjs`.

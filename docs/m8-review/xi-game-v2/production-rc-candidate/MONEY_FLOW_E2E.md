# MONEY_FLOW_E2E — Test provider closed loop

## Scope

Prove deposit/withdraw **TEMP test provider** → wallet + ledger idempotent. Real-money channels stay fail-closed (`NOT_PRODUCTION_READY`).

## Unit evidence (`tests/deposit-withdraw.test.mjs`) — PASS

| Case | Result |
|------|--------|
| Deposit create → confirm credits once | balance 1000→2000 |
| Double confirm idempotent | `alreadyCredited`; balance stays 2000 |
| Create idempotency key reuse | `alreadyExists` |
| Reject non-preset / cross-player confirm | fail-closed |
| Withdraw hold → reject releases | frozen cleared |
| Withdraw approve → pay keeps debit | available reduced once |
| Anti-overdraw | rejected |

## Live smoke evidence (same player `dev-test-player`, `:5173`) — 2026-08-07

From production-rc smoke / integrated smoke (28/28):

1. `GET /api/v1/game/deposit/channels` → readiness **NOT_PRODUCTION_READY**
2. `POST /api/v1/game/deposit` → order PENDING (KBZ TEMP)
3. `POST /api/v1/game/deposit/confirm` → SUCCESS credit (test harness)
4. `GET /api/v1/game/withdraw` readiness → **NOT_PRODUCTION_READY**
5. `POST /api/v1/game/withdraw` → UNDER_REVIEW hold created
6. Admin deposits / withdrawals list **200**

## Ledger / wallet invariants

- No client-authored balance writes
- Credits/debits via MoneyService + idempotency keys
- Live PSP confirm without secrets → 503 fail-closed (not exercised as success)

## Gate

**TEST closed loop: PROVEN** · **Production money: PENDING (BR unfrozen)**

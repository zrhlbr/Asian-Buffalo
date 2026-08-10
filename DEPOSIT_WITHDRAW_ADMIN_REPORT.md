# DEPOSIT_WITHDRAW_ADMIN_REPORT

## Deposits — PARTIAL (policy)
- List orders from `deposit_orders`.
- Confirm endpoint exists but **fail-closed**: without `AB_ALLOW_TEST_IDENTITY=1` → `503 PROVIDER_NOT_CONFIGURED`.
- No “click to add balance” in production.

## Withdrawals — PARTIAL (policy)
- Status workflow via service: approve / reject / pay.
- V1 review always required (fail-closed posture in withdrawal-service).
- Reject/pay go through MoneyService TEST adapter — **REAL money GATE CLOSED**.

## Verdict
Ops can view and rehearse review UX; **PRODUCTION MONEY READY = NO**.

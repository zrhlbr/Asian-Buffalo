# PAYMENT_PRODUCTION_READINESS — Step 5

| Channel | ID | Currency | Min/Max | Fee | Status | Provider | Callback | Timeout | Recon | Prod? |
|---------|----|----------|---------|-----|--------|----------|----------|---------|-------|-------|
| KBZPay | `KBZ` | MMK | via deposit presets / admin min-max | n/a (deposit) | enabled seed | **TEMP** | **unset** | null | false | **TEMP / NOT_PRODUCTION_READY** |
| WavePay | `WAVE` | MMK | via deposit presets / admin min-max | n/a (deposit) | enabled seed | **TEMP** | **unset** | null | false | **TEMP / NOT_PRODUCTION_READY** |
| USDT TRC20 | `TRC20` | USDT | n/a | n/a | **disabled** (BR-009) | **TEMP** | **unset** | null | false | **TEMP / NOT_PRODUCTION_READY** |

## Withdraw path

| Item | Value |
|------|-------|
| Channels reused | Enabled MMK channels (KBZ/WAVE) |
| Fee | `wallet_commerce_config.withdrawal.feeMinor/feeBps` placeholders (`0`) |
| Min/Max/Daily | placeholders — see BR-006 |
| Review | Always review-required in V1 fail-closed |
| Live pay provider | **TEMP** harness (`markWithdrawalPaid`) — not live PSP |

## Fail-closed controls

| Gate | Behavior |
|------|----------|
| Player/admin deposit confirm without test identity | HTTP 503 `PROVIDER_NOT_CONFIGURED` |
| Channel without `productionReady` + callback | Aggregate readiness `NOT_PRODUCTION_READY` |
| UI | Banner + TEMP label on test confirm |
| TRC20 | Disabled until multi-currency signed |

## Promotion checklist (Zhao)

1. Provider merchant IDs + secrets in secure env (never audit logs)
2. Signed callback URL + HMAC verification endpoint
3. Timeout + recon jobs
4. Admin set `productionReady: true` on channel + deposit/withdraw config
5. Re-run PAYMENT matrix + wallet-ledger consistency

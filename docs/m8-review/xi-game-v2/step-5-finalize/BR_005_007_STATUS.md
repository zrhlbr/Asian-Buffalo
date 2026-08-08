# BR-005 / BR-006 / BR-007 STATUS — Step 5

**Policy:** Never invent Zhao production numbers. Admin-configurable placeholders remain until business sign-off. Fail Closed.

| ID | Area | Production vs placeholder | Runtime behavior | Status |
|----|------|---------------------------|------------------|--------|
| BR-005 | Deposit presets / min / max / TTL | **Placeholder** seeds in `wallet_commerce_config.deposit` (`productionReady: false`) | Players may create orders against admin presets; amounts still validated server-side | **NOT_PRODUCTION_READY** |
| BR-006 | Withdrawal min/max/daily/fee/review | **Placeholder** seeds in `wallet_commerce_config.withdrawal` (`productionReady: false`, fee 0) | Hold/debit + admin review machine works; fee/limits not Zhao-signed | **NOT_PRODUCTION_READY** |
| BR-007 | Payment channels KBZ / Wave / TRC20 | Channels seeded; `provider: TEMP`, `callbackConfigured: false`, `productionReady: false`; TRC20 disabled (BR-009) | Live confirm **fail-closed** (`PROVIDER_NOT_CONFIGURED` 503) without `AB_ALLOW_TEST_IDENTITY`; UI shows `NOT_PRODUCTION_READY` banner; test confirm labeled TEMP | **NOT_PRODUCTION_READY** |

## What is live-capable today

- Order/request persistence, idempotency, MoneyService credit/debit holds
- Admin upsert of deposit/withdraw config (explicit `productionReady` flag required to flip readiness)
- Test harness confirm when `AB_ALLOW_TEST_IDENTITY=1`

## What is NOT production

- Live KBZ / Wave / TRC20 credentials, callback HMAC, timeout, reconciliation
- Zhao-signed preset list / fee table / daily caps
- USDT multi-currency (BR-009) — TRC20 remains disabled by default

## UI / API contract

- `GET /api/v1/game/deposit/channels` and `GET /api/v1/game/withdraw` include `readiness` with `code: NOT_PRODUCTION_READY` until admin sets channel + config `productionReady` **and** live callback is configured
- Deposit / Withdraw panels render `lobby.commerce.notProductionReady` banner when unset
- Test confirm button only shown when test harness allowed

## Zhao action required (blocked for RC production money)

1. Sign deposit presets / min / max / TTL → set admin config `productionReady: true`
2. Sign withdraw fee / daily / VIP gates → set admin config `productionReady: true`
3. Supply live channel credentials + callback secrets → set channel `productionReady`, `callbackConfigured`, non-TEMP `provider`

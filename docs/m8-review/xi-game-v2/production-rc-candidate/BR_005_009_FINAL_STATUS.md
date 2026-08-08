# BR_005_009_FINAL_STATUS

**Policy:** No invented Zhao production values. Admin-configurable placeholders + fail-closed prod + TEST harness only.  
**Label implication:** Money channels remain **disabled for real money** until BR freeze.

| ID | Area | Production vs placeholder | Runtime | Status |
|----|------|---------------------------|---------|--------|
| BR-005 | Deposit presets / min / max / TTL | Placeholder seeds in `wallet_commerce_config.deposit` (`productionReady: false`) | Server validates amounts against admin config; presets not Zhao-signed | **NOT_PRODUCTION_READY** |
| BR-006 | Withdraw min/max/daily/fee/review | Placeholder (`productionReady: false`, fee 0) | Hold/debit + admin review machine works; limits/fees not Zhao-signed | **NOT_PRODUCTION_READY** |
| BR-007 | KBZ / Wave / TRC20 live PSP | Channels seeded; `provider: TEMP`, `callbackConfigured: false`, `productionReady: false` | Live confirm **fail-closed** (`PROVIDER_NOT_CONFIGURED` 503) without secrets; test confirm only when `AB_ALLOW_TEST_IDENTITY` | **NOT_PRODUCTION_READY** |
| BR-009 | USDT multi-currency | TRC20 disabled / placeholder | No live USDT path | **NOT_PRODUCTION_READY** |

## Live-capable today (TEST only)

- Order/request persistence + idempotency
- MoneyService credit/debit holds via TEMP harness
- Admin upsert of config (explicit `productionReady` required to flip readiness)
- UI banners: `lobby.commerce.notProductionReady`

## NOT production

- Live KBZ / Wave / TRC20 credentials, callback HMAC, reconciliation
- Zhao-signed preset list / fee table / daily caps
- USDT multi-currency (BR-009)

## Zhao freeze checklist (blocked for Money Ready)

1. Sign deposit presets / min / max / TTL → admin `productionReady: true`
2. Sign withdraw fee / daily / VIP gates → admin `productionReady: true`
3. Supply live channel credentials + callback secrets → non-TEMP provider + `callbackConfigured`
4. Explicit BR-009 decision on USDT

Until then: **Production RC Candidate — Money Gate Pending** (never Production Money Ready).

# DEPOSIT_FLOW

```
Admin config (presets/channels)
  → Player: currency (MMK) → channel → preset amount → POST /deposit
  → Order CREATED/PENDING (provider_ref, expires_at)
  → Provider callback OR test confirm (AB_ALLOW_TEST_IDENTITY / admin confirm)
  → status PROCESSING → MoneyService.credit(order.amountMinor) → SUCCESS
  → FE refreshes balance
```

**Statuses:** CREATED → PENDING → PROCESSING → SUCCESS | FAILED | EXPIRED | CANCELLED  

**Fail closed:** non-preset amount; disabled channel; expired order; amount mismatch; cross-player confirm; live provider without secrets (BR-007).  
**Idempotency:** `deposit_orders.idempotency_key` unique + MoneyService intent key.

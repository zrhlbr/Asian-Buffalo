# WALLET_LEDGER_FLOW

```
Player UI (lobby / hub / slot HUD)
  → GET /api/v1/game/wallet/balance  (available + frozen)
  → GET /api/v1/game/wallet          (snapshot + recent moves)
  → createRouteMoneyService → D1Ledger PLAYER_AVAILABLE

Credits / Debits (never client):
  Deposit SUCCESS     → MoneyService.credit  idempotency `deposit:{orderId}`
  Withdraw create     → MoneyService.debit   idempotency `withdraw-hold:{id}`
  Withdraw reject/cancel → MoneyService.credit `withdraw-release:{id}`
  VIP / activity / check-in → MoneyService.credit with unique claim keys
```

**Frozen:** sum of withdrawal amounts in `PENDING|UNDER_REVIEW|APPROVED|PAYING`.  
**Ledger kind note:** MoneyService adapter currently posts GAME_PAYOUT/GAME_BET kinds (core not rewritten). Intent keys remain unique for reconciliation. Dedicated DEPOSIT/WITHDRAWAL posting kinds deferred (would require MoneyService core change — pause trigger).

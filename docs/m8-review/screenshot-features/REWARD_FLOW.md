# REWARD_FLOW.md

```
Player opens VIP modal → GET /vip/rewards
  → claimable if VIP ACTIVE + level in [min,max] + not claimed + amount>0
Player claims → POST /vip/rewards/claim { rewardDefId }
  → fail closed on VIP/currency/amount
  → MoneyService.credit(idempotencyKey=vip-reward:{player}:{def}:{periodKey})
  → INSERT vip_reward_claims (unique idempotency_key)
  → FE refreshes wallet balance (Formal path)
```

Kinds: DAILY / WEEKLY / MONTHLY / LEVEL / EVENT.  
Amounts from `vip_reward_defs` only (BR-003). EVENT seeded disabled with amount 0.

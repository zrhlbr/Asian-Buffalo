# REWARD_FLOW

VIP chests (existing):

1. `GET /vip/rewards` — claimable flags from defs + VIP status/level + period keys  
2. `POST /vip/rewards/claim` `{ rewardDefId }` — rejects client `amountMinor`  
3. `MoneyService.credit` with `vip-reward:{idem}`  
4. `vip_reward_claims` unique idempotency  

FE animation presentation-only; balance refresh from wallet API.

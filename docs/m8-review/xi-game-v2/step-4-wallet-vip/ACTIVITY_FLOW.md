# ACTIVITY_FLOW

**Activities**

- Table `player_activities` with starts_at/ends_at  
- Expired (`now > ends_at`) → `lockedReason=EXPIRED`, not joinable  
- Claim → MoneyService.credit once per player/activity  

**Check-in**

- Config `wallet_commerce_config.checkin` (rewardMinor placeholder)  
- One claim per UTC day (`player_id + day_key` unique)  
- Idempotent re-POST returns alreadyClaimed  

Admin: `GET/POST /api/admin/activities` (RBAC activity:view/manage + reason).

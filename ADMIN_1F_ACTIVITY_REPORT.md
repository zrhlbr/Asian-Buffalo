# ADMIN-1F Activity Report

## Admin

List + upsert with trilingual title/body (canonical zh/en/my normalized to legacy keys for storage).  
Kinds selectable: CHECKIN / NEW_PLAYER / VIP / EVENT / FESTIVAL / TASK / INVITE / JACKPOT.

Enabled → ACTIVE; disabled → PAUSED (existing enabled flag).

## Reward safety

- `REWARD_PAYOUT = BLOCKED` for admin credit (`creditPlayer` / `payout` → `REWARD_PAYOUT_BLOCKED`)
- Player claim remains via Activity Service → MoneyService under **TEST** gate only
- PRODUCTION MONEY GATE CLOSED unchanged

## Participant count

Not a first-class admin metric this phase (claim tables exist; UI shows joinable/lockedReason). FUTURE enhancement.

# ADMIN-1F VIP Report

## Admin

- Level list (existing `vip/levels`)
- Player assign (existing; no wallet credit)
- Titles normalized to shared locale model

## Blocked high-risk edits

API rejects: `rtpBonus`, `moneyMultiplier`, `walletCredit` (top-level or conditions) → `VIP_HIGH_RISK_BLOCKED`.

## Scope

Display / content / assign only. Core VIP calculation unchanged. No RTP / money multiplier ops UI.

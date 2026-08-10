# ADMIN_1B_PLAYERS_REPORT

## List
- Server pagination: page / pageSize 20|50|100 + total
- Search (debounced 350ms): Player ID / nickname / phone / email / wallet ref
- Filters: status ACTIVE|LOCKED|CLOSED · online/offline · VIP≥ · registered date range
- Columns: ID, nickname, masked contact, VIP, status, online, risk badge, registered, last login
- Mobile: card list ≤768px

## Detail tabs
Overview · Sessions · Devices · Login History · Game Summary · Wallet Summary (RO)

## Status model — CURRENT MODEL LIMITATION
| DB | UI label |
|----|----------|
| ACTIVE | 正常 |
| LOCKED | 冻结 |
| CLOSED | 封禁 |

No independent `BAN` enum. UI does not pretend three unrelated backend states exist beyond this mapping.

## High-risk actions
Freeze / Unfreeze / Ban(close) / Unban(reopen) / Session revoke  
→ DangerConfirm + reason + audit before/after + requestId + toast + refresh

## Wallet summary (1B only)
Available / Frozen / Total from ledger account kinds — read-only. Full Wallet Center → ADMIN-1D.

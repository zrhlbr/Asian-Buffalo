# PLAYERS_ADMIN_REPORT

## Status: CONNECTED (local) / PARTIAL (prod deploy pending)

## List
UID, nickname, phone masked, register/last login, status, VIP, currency, open sessions, IP/device (when `player_auth_sessions` exists), search/page/sort/filter by status.

## Detail
Profile, VIP, sessions, recent rounds, wallet intents, ledger accounts, **riskTags**.

## Actions (reason + audit + confirm)
| Action | API | Status map |
|--------|-----|------------|
| Freeze / Unfreeze | POST …/freeze\|unfreeze | ACTIVE ↔ LOCKED |
| Restrict login / Restore | POST …/close\|reopen | ACTIVE ↔ CLOSED |

## Forbidden
Direct balance UPDATE — UI shows forbidden; no API.

## Remaining
- MMK/USDT dual balance columns depend on ledger accounts present.
- Online filter is openSessions>0 proxy, not separate presence service.
- Email field not in schema (phone only via profile).

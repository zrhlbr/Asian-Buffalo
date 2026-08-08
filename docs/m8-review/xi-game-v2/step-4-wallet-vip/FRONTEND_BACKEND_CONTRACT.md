# FRONTEND_BACKEND_CONTRACT — Step 4

**Auth:** `resolveActivePlayer` / runtime identity (`AB_ALLOW_TEST_IDENTITY=1` → DevTest).  
**Balance:** Never accepted from client body. Refresh via `GET /wallet/balance` or `GET /wallet`.

## Player APIs (additive)

| Method | Path | Body | Response | Notes |
|--------|------|------|----------|-------|
| GET | `/api/v1/game/wallet` | — | `{ wallet }` | available/frozen/recentMoves/status |
| GET | `/api/v1/game/wallet/balance` | — | `{ balanceMinor, availableMinor, frozenMinor, currency }` | Shared refresh |
| GET | `/api/v1/game/deposit/channels` | — | `{ config, channels }` | Presets + enabled channels |
| GET | `/api/v1/game/deposit` | — | `{ items }` | Player orders |
| POST | `/api/v1/game/deposit` | `{ channelCode, amountMinor, idempotencyKey }` | `{ order }` | Amount ∈ presets only |
| POST | `/api/v1/game/deposit/confirm` | `{ orderId \| providerRef }` | `{ order, balanceAfterMinor }` | Test harness only |
| GET | `/api/v1/game/withdraw` | — | `{ config, channels, items }` | |
| POST | `/api/v1/game/withdraw` | `{ channelCode, account, amountMinor, idempotencyKey }` | `{ request }` | Hold debit |
| POST | `/api/v1/game/withdraw/:id/cancel` | — | `{ request }` | Release hold |
| GET | `/api/v1/game/activities` | — | `{ items }` | |
| POST | `/api/v1/game/activities` | `{ activityId }` | `{ claim }` | Rejects client amount |
| GET/POST | `/api/v1/game/checkin` | POST `{}` | `{ checkin }` / `{ claim }` | Daily idempotent |
| GET | `/api/v1/game/wins` | — | `{ items, total }` | Round RO |
| GET/PATCH | `/api/v1/game/profile*` | existing | existing | Unchanged contract |
| GET/POST | `/api/v1/game/vip*` | existing | existing | Unchanged contract |
| GET | `/api/v1/game/announcements` | existing | existing | Schedule filter |

## Admin APIs (additive)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/admin/deposits` | deposit:view |
| GET/POST | `/api/admin/deposits/config` | deposit:view / deposit:manage |
| POST | `/api/admin/deposits/:id/confirm` | deposit:manage (+ test identity) |
| GET | `/api/admin/withdrawals` | withdraw:view |
| GET/POST | `/api/admin/withdrawals/config` | withdraw:view / withdraw:review |
| POST | `/api/admin/withdrawals/:id/approve\|reject` | withdraw:review |
| POST | `/api/admin/withdrawals/:id/pay` | withdraw:pay |
| GET/POST | `/api/admin/activities` | activity:view / activity:manage |

Mutations require `reason` + audit log.

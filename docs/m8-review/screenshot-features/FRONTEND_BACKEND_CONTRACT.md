# FRONTEND_BACKEND_CONTRACT.md

**Auth:** Runtime identity (`AB_ALLOW_TEST_IDENTITY=1` → DevTest player; production fail-closed).  
**Balance:** Never accepted from client body. Display refresh via `GET /api/v1/game/wallet/balance` or FormalGameProvider.

## Player APIs

| Method | Path | Body | Response | Notes |
|--------|------|------|----------|-------|
| GET | `/api/v1/game/profile` | — | `{ profile, avatars[] }` | Creates sidecar row if missing |
| PATCH | `/api/v1/game/profile` | `{ nickname }` | `{ profile }` | Rejects balance fields |
| POST | `/api/v1/game/profile/avatar` | `{ avatarId }` | `{ profile }` | `ab-avatar-01`…`16` |
| POST | `/api/v1/game/profile/phone` | `{ phoneE164 }` | `{ profile, pending }` | E.164 stub; SMS BR-004 |
| GET | `/api/v1/game/vip` | — | `{ vip }` | level/status/validity |
| GET | `/api/v1/game/vip/levels` | — | `{ vip, levels, config }` | 1–6 switcher data |
| GET | `/api/v1/game/vip/rewards` | — | `{ chests[] }` | claimable flags |
| POST | `/api/v1/game/vip/rewards/claim` | `{ rewardDefId, idempotencyKey? }` | `{ claim }` | MoneyService.credit |

## Admin APIs (additive)

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/api/admin/vip/levels` | vip:view | Config list |
| POST | `/api/admin/vip/levels` | vip:manage | Upsert conditions JSON + reason |
| GET | `/api/admin/vip/players/:id` | vip:view | Player VIP |
| POST | `/api/admin/vip/players/:id` | vip:manage | Set level/status/expiry + reason |
| GET | `/api/admin/players` | players:view | Includes nickname/avatarId/vip |

## Overlay open rules (FE)

| Modal | During `game.busy` |
|-------|--------------------|
| Profile / VIP / Wallet | Blocked + toast |
| Help | Blocked until spin ends (same wait) |
| Paytable / Settings | Existing behavior |

Close = toggle `.hidden` only — never `world.dispose()` / renderer destroy.

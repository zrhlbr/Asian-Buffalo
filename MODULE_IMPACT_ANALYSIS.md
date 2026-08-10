# MODULE_IMPACT_ANALYSIS

## Intentional scope (this round)
Admin console only:
- `lib/admin/*`
- `app/admin/**`
- `app/api/admin/**` (unchanged entry; handlers in lib)
- `tests/r1-m7-admin.test.mjs` (existing)
- Delivery markdowns at repo root / `docs/m9-admin/*`

## Not modified for this task
- ZRHPay Website / Admin / Accounts / SDK / Integration Center
- Game Math / RTP / RNG / paytable cores
- Player-facing reel commercial polish (pre-existing dirty tree may show M8 files — **out of this round’s edits**)

## Cross-module necessity
| Touch | Why necessary |
|-------|----------------|
| deposit/withdraw/vip/activity **services** (read/call only from admin-api) | Already existing commerce services; admin routes invoke, do not rewrite money cores |
| `game_sessions.status=REVOKED` | Session revoke requirement |
| `players.status` CLOSED/LOCKED | Freeze / login-restrict |

## Isolation
《西游戏》Admin remains separate brand, cookie, admin table, API prefix from ZRHPay.

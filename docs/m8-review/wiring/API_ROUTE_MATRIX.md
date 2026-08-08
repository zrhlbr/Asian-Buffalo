# API ROUTE MATRIX

## Player `/api/v1/game/*` (M8 + M9 shared)

| Method | Route | Handler | Wallet/DB | allowRealMoney | Notes |
|---|---|---|---|---|---|
| POST | `/api/v1/game/sessions` | handleCreateSession | D1 sessions/math | n/a | empty body only |
| POST | `/api/v1/game/spins` | handleSpin → orchestrateSpin | **D1 MoneyService** | **false** | server RNG only |
| GET | `/api/v1/game/wallet/balance` | route GET | **D1 ledger balance** | n/a | seeds 100000 MMK in test identity |
| GET | `/api/v1/game/rounds/:roundId` | handleGetRound | D1 game_rounds | n/a | owner check |
| GET | `/api/v1/game/rules/:mathVersion` | handleGetRules | D1 math | n/a | FROZEN production version |
| GET | `/api/v1/game/announcements` | listPlayerAnnouncements | admin_announcements | n/a | PUBLISHED + schedule filter |

Legacy in-memory `routeTestWalletAdapter` remains in `lib/route-test-services.ts` for tests/docs only — **not** wired to live spin/balance routes.

## Admin `/api/admin/*` (M9 canonical)

See `FRONTEND_BACKEND_CONTRACT.md` admin table. Catch-all: `app/api/admin/[...slug]/route.ts` → `handleAdminApi`.

Money-safety: no wallet/ledger/math write endpoints. Only game mutation: `players.status` freeze/unfreeze (+ admin self-management).

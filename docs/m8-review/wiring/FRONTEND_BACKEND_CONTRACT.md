# FRONTEND ↔ BACKEND CONTRACT (Wiring)

Baseline: `9654d4194d2db801467af34cef1ddc5650fd310f`  
Updated: 2026-08-07 — durable D1 wallet/ledger + announcements + admin RBAC UI.

## Player (M8 FormalGameProvider)

| UI / Component | Method | Path | Request | Response | Errors | Auth | Status |
|---|---|---|---|---|---|---|---|
| Boot / ensureReady | POST | `/api/v1/game/sessions` | `{}` | `{ sessionId, mathVersionId, expiresAt }` | 401/503 `UNAUTHORIZED`/`SERVICE_UNAVAILABLE` | Runtime identity | PASS |
| Boot | GET | `/api/v1/game/rules/:mathVersion` | — | ExecutableMathVersion JSON | 404 | Runtime identity | PASS |
| Boot / resume / HUD | GET | `/api/v1/game/wallet/balance` | — | `{ playerId, currency, balanceMinor }` | 401/403/503 | Runtime identity | PASS (D1 ledger) |
| Spin CTA | POST | `/api/v1/game/spins` | `{ sessionId, roomBase, betLevel, betMultiplier, idempotencyKey }` | SpinResult (grid, wins, `balanceAfterMinor`, …) | 400/402/403/409/503 | Runtime identity | PASS (D1 MoneyService) |
| Recovery | GET | `/api/v1/game/rounds/:roundId` | — | SpinResult shape | 404 | Runtime identity | PASS |
| Announcement toast | GET | `/api/v1/game/announcements` | — | `{ items: [{ id, title, level, locales, publishAt, expiresAt }] }` | 401/503 | Runtime identity | PASS |
| Turbo / Auto / Sound / Lang / Settings / Quality | — | client-only | — | presentation | — | n/a | PASS (no fake API) |
| Paytable modal | — | local `game-config` (+ rules validated at boot) | — | — | — | n/a | PARTIAL (display local; rules fetched) |
| Room / History / Exit / Reconnect buttons | — | **no UI** | — | — | — | — | N/A (not shown; reconnect via `recoverLastRound` + resume balance) |

**Identity:** Production fail-closed (`UnconfiguredIdentityProvider` → 503). Local play: `AB_ALLOW_TEST_IDENTITY=1` → `DevTestIdentityProvider` + seed 100000 MMK.

**Money:** Spins/balance use `DbWalletAdapter` → `MoneyService` → D1 `wallet_intents` / `wallet_provider_ops` / `ledger_*`. `allowRealMoney: false`.

## Admin (M9 `/admin`)

| Module | Method | Path | Permission | Status |
|---|---|---|---|---|
| Login | POST | `/api/admin/login` | none | PASS |
| Me | GET | `/api/admin/me` | `dashboard:view` | PASS (+ `permissions[]`) |
| Dashboard | GET | `/api/admin/dashboard` | `dashboard:view` | PASS (SQL KPIs) |
| Players | GET/POST freeze | `/api/admin/players*` | `players:view` / `players:freeze` | PASS |
| Sessions | GET | `/api/admin/sessions*` | `rounds:view` | PASS |
| Rounds / Spins | GET | `/api/admin/rounds*` `/spins*` | `rounds:view` | PASS + deep links |
| Wallet | GET | `/api/admin/wallet/*` | `wallet:view` | PASS RO |
| Ledger | GET | `/api/admin/ledger/*` | `ledger:view` | PASS RO |
| Math | GET | `/api/admin/math-versions*` | `math:view` | PASS FROZEN RO |
| Risk | GET | `/api/admin/risk/signals` | `risk:view` | PASS (SQL-derived) |
| Reports | GET | `/api/admin/reports/ops` | `dashboard:view` | PASS |
| System / Announcements | GET/POST | `/api/admin/system/*` | `system:view` / `system:manage` | PASS |
| Admins / RBAC | GET/POST | `/api/admin/admins*` | `admins:view` / `admins:manage` | PASS |
| Audit logs | GET | `/api/admin/logs/admin` | `logs:view` | PASS (System tab) |
| Game audit | GET | `/api/admin/logs/game` | `logs:view` | PARTIAL (API only, no UI tab) |

Unauthenticated → **401**. Missing permission → **403** (backend). UI nav gated by `permissions` from `/me`.

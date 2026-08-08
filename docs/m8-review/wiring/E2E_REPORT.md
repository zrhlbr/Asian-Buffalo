# E2E REPORT

## Automated contract E2E (executed)

| Step | Evidence | Result |
|---|---|---|
| Seed TEST balance 100000 MMK via D1 ledger | `tests/r1-m8-wiring-d1-money.test.mjs` | **PASS** |
| Settle spin → wallet intent SUCCESS | same | **PASS** |
| Ledger tx POSTED with `round_id` | same | **PASS** |
| Balance after = 99970 (bet 50 win 20) | same | **PASS** |
| Announcements schedule/expiry filter | same | **PASS** |
| Admin login / RBAC 403 / RO wallet-ledger-math | `tests/r1-m7-admin.test.mjs` (M9) | **PASS** (19 cases) |
| API handlers session/spin/round/rules | `tests/api-handlers.test.mjs` | **PASS** |
| Money service idempotency / REAL deny | `tests/r1-m4-money.test.mjs` | **PASS** |

## Browser live E2E (headed)

| Step | Status |
|---|---|
| Start Vite/Workers + Miniflare D1 | **NOT RUN** in this session |
| Login/identity → balance 100000 → spin → admin same round | **BLOCKED** — no long-lived headed browser + capture pipeline executed here |

**Blocker:** Automated browser Playwright/capture not invoked; environment has unit/integration SQLite proofs instead. Code path for live routes is wired to the same D1 money stack proven in `r1-m8-wiring-d1-money`.

To complete headed E2E locally:
1. `AB_ALLOW_TEST_IDENTITY=1` in `.dev.vars`
2. `npm run dev` in M8
3. Open game → confirm balance 100000 → spin
4. Open M9 `/admin` → login → Players `dev-test-player` → Rounds/Wallet/Ledger for same idempotency/round

See `DATA_CONSISTENCY_REPORT.md` and `BLOCKED_CAPTURE.md`.

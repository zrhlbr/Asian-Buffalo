# GATE_RESULTS — XI GAME V2 Phase 1

Date: 2026-08-07

| Gate | Command | Result | Notes |
|------|---------|--------|-------|
| Unit smoke | `node --experimental-strip-types --test tests/xi-lobby-phase1.test.mjs` | **PASS** (5/5) | Catalog, i18n, routes, P0 stacking |
| Lint (lobby scope) | `npx eslint client/xi-lobby app/xi app/game/page.tsx app/api/v1/lobby lib/lobby-catalog.ts` | **PASS** | Exit 0 |
| Lint (repo script) | `npm run lint` | **BLOCKED (env)** | `scripts/sites-env.sh` fails on Windows CRLF (`pipefail\r`) — pre-existing; lobby-scoped eslint used |
| TypeCheck | `npx tsc --noEmit` | **FAIL (pre-existing)** | Errors in `app/admin/modules/admins.tsx`, `db/index.ts`, `examples/d1`, `vite.config.ts`, `worker/index.ts` — **no errors under `client/xi-lobby`, `app/xi`, `app/game`, `lib/lobby-catalog`, lobby API** |
| Build | `npx vinext build` | **PASS** | Routes include `/`, `/game`, `/xi`, `/xi/bdk`, `/api/v1/lobby/catalog` |
| Playwright smoke | `node docs/m8-review/xi-game-v2/phase-1/_smoke-lobby.mjs http://127.0.0.1:5174` | **PASS** | `/xi`, `/xi/bdk`, `/`, `/game` all 200; screenshots saved |
| Playwright project config | `package.json` scripts / `@playwright/test` dep | **Not configured** | Used `npx playwright` + local smoke script instead |
| `vinext start` prod smoke | `npx vinext start --port 3000` | **BLOCKED (pre-existing)** | `env` undefined → `AB_ALLOW_TEST_IDENTITY` TypeError in worker bridge |

## Screenshots

`docs/m8-review/xi-game-v2/phase-1/screenshots/`

- `01-lobby-phone.png` — lobby loaded (BDK + coming-soon cards)
- `02-bdk-hub-phone.png` — hub stub
- `03-slot-root.png` — `/` slot reachable
- `04-slot-game-alias.png` — `/game` alias
- `05-lobby-pc.png` / `06-slot-still-reachable.png` — extra PC / regression

## Phase 2

**NOT STARTED.**

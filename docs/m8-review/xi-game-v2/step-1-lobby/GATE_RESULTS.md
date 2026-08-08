# Step 1 Lobby — GATE_RESULTS

**Date:** 2026-08-07  
**Base URL tested:** `http://127.0.0.1:5173`

| Gate | Result | Notes |
|------|--------|-------|
| E2E smoke `/xi` | **PASS** | `_smoke-step1.mjs` — phone/tablet/PC shots |
| Card → stub route | **PASS** | `/xi/bull-demon-king` stub; back → `/xi` |
| Step 2 not started | **PASS** | `/xi/bull-demon-king/play` → **404**, no play shell |
| i18n zh/en/my | **PASS** | Brand + bottom-nav Home keys; `assertLobbyI18nComplete` ok |
| Slot `/` regression | **PASS** | `#gl` attached; `#hud` transform `none` |
| Lint (scoped lobby) | **PASS** | `eslint client/xi-lobby app/xi lib/lobby-catalog` exit 0 |
| TypeCheck (lobby filter) | **PASS** | No `xi-lobby` / `app/xi` / `lobby-catalog` diagnostics |
| TypeCheck (full repo) | **BLOCKED / pre-existing FAIL** | Unrelated: `app/admin`, `db/index.ts`, `worker`, `examples/d1`, `vite.config.ts` |
| Build | **NOT re-run this gate** | Dev server already serving routes 200; full `npm run build` deferred (pre-existing env weight). Honest: smoke + scoped lint/tsc used as primary gates. |

Smoke detail: `smoke-results.json`.

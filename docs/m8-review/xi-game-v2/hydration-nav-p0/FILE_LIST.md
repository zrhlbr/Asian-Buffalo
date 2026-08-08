# FILE_LIST — hydration-nav-p0

## Code (modified / added)

| Path | Action |
|------|--------|
| `app/xi/layout.tsx` | ADD/UPDATE — mount XiShell |
| `app/xi/loading.tsx` | ADD — light loading bar |
| `client/xi-lobby/xi-shell.tsx` | ADD — persistent shell, prefetch, soft nav register |
| `client/xi-lobby/ui-store.ts` | ADD — hydration-safe quality store |
| `client/xi-lobby/nav.ts` | UPDATE — soft navigator, light veil, 180–260ms |
| `client/xi-lobby/lobby-app.tsx` | UPDATE — ui-store; post-hydrate particles |
| `client/xi-lobby/bdk-hub.tsx` | UPDATE — ui-store; soft Start |
| `client/xi-lobby/play-shell.tsx` | UPDATE — soft leave timings |
| `client/xi-lobby/quality.ts` | UPDATE — baseline tier + `prefetchXiNavAssets` |
| `client/xi-lobby/i18n.ts` | UPDATE — cookie mirror; server snapshot docs |
| `client/xi-lobby/lobby.css` | UPDATE — soft veil, nav-busy, route loading |
| `app/game-client.tsx` | UPDATE — singleton + pause/resume hooks |
| `client/m5/boot.ts` | UPDATE — `pause` / `resume` on handle |
| `tests/xi-hydration-nav-p0.test.mjs` | ADD — static/unit guards |

## Delivery docs

| Path |
|------|
| `MODULE_IMPACT_ANALYSIS.md` |
| `HYDRATION_ROOT_CAUSE.md` |
| `BLACK_SCREEN_ROOT_CAUSE.md` |
| `NAVIGATION_PERFORMANCE_REPORT.md` |
| `XI_LAYOUT_LIFECYCLE.md` |
| `ROUTE_PREFETCH_REPORT.md` |
| `MOBILE_NAVIGATION_REPORT.md` |
| `HYDRATION_E2E_REPORT.md` |
| `REGRESSION_REPORT.md` |
| `FILE_LIST.md` |
| `REVIEW_PATCH.md` |
| `AB-XI-HYDRATION-NAV-P0-review.patch` |
| `SHA256.txt` |
| `BLOCKED_CAPTURE.md` |
| `e2e-results.json` |
| `_e2e-hydration-nav.mjs` |
| `screenshots/*` |

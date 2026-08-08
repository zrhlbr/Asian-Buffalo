# FILE_LIST — Production RC Candidate whitelist touch

## Code (this package)

| Path | Action |
|------|--------|
| `lib/admin/admin-queries.ts` | Fix `runRaw` D1/better-sqlite3 |
| `lib/admin/admin-api.ts` | INTERNAL_ERROR envelope on handler throw |
| `D:\Asian-Buffalo-R1-M9-Cursor-Clean\lib\admin\admin-queries.ts` | Hash-sync |
| `D:\Asian-Buffalo-R1-M9-Cursor-Clean\lib\admin\admin-api.ts` | Hash-sync |
| `lib/rankings-service.ts` | **new** rankings aggregate |
| `app/api/v1/game/rankings/route.ts` | **new** GET rankings |
| `client/xi-lobby/api.ts` | `fetchRankings` |
| `client/xi-lobby/commerce-panels.tsx` | `RankingsPanel` |
| `client/xi-lobby/bdk-hub.tsx` | Wire rankings modal |
| `client/xi-lobby/i18n.ts` | Additive range keys zh/en/my |
| `tests/rankings.test.mjs` | **new** |
| `package.json` | `test:win` / `lint:win` / `build:win` |

## Docs (this package)

All under `docs/m8-review/xi-game-v2/production-rc-candidate/`:

- MODULE_IMPACT_ANALYSIS.md
- ADMIN_PLAYERS_500_ROOT_CAUSE.md
- RANKINGS_API_REPORT.md
- BR_005_009_FINAL_STATUS.md
- MONEY_FLOW_E2E.md
- REAL_DEVICE_REPORT.md
- PERFORMANCE_REPORT.md
- FINAL_E2E_REPORT.md
- I18N_PARITY_SCAN.md
- TECH_DEBT_CLASSIFICATION.md
- GATE_RESULTS.md
- BLOCKED_CAPTURE.md
- ACCEPTANCE_NOTE.md
- FILE_LIST.md
- REVIEW_PATCH.md
- SHA256.txt
- GIT_STATUS_NOTE.txt
- screenshots/*.png

## Explicit non-touch

Lobby/hub layout cores · slot reel/animals/math/RTP/RNG · wallet-ledger MoneyService cores · `#hud` shell translateZ

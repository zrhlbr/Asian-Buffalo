# REVIEW_PATCH — Production RC Candidate

## Binary patch artifact

- Tracked diffs (admin + package): `AB-XI-PRODUCTION-RC-review.patch`
- New untracked whitelist files (not in git index): see FILE_LIST — apply via workspace copy / later commit by Zhao

## Summary of code delta

### P0 Admin Players

`lib/admin/admin-queries.ts` — dual-driver `runRaw`:
- D1: `prepare().bind(...).all()` → unwrap `{ results }`
- better-sqlite3: `prepare().all(...params)` unchanged

`lib/admin/admin-api.ts` — catch handler throws → `INTERNAL_ERROR` JSON 500

M9 twin hash-synced (identical SHA-256).

### P1 Rankings

- `lib/rankings-service.ts` + `app/api/v1/game/rankings/route.ts`
- Hub FE: `RankingsPanel` + `fetchRankings` + i18n range keys
- `tests/rankings.test.mjs`

### P6 Windows

`package.json`: `test:win`, `lint:win`, `build:win`

## Verify

```text
npm run test:win          # 314/315 (hosting.json pre-existing)
npm run build:win         # exit 0
# with dev server:
node docs/m8-review/xi-game-v2/integrated-rc/_smoke-integrated.mjs  # 28/28
```

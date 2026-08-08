# FINAL_E2E_REPORT — same player full chain

**Player:** `dev-test-player` · **Base:** `http://127.0.0.1:5173` · **Date:** 2026-08-07  
**Smoke:** `docs/m8-review/xi-game-v2/integrated-rc/_smoke-integrated.mjs` → **28/28 PASS**

| Step | Action | Result |
|------|--------|--------|
| 1 | Routes `/xi`, hub, play, `/admin`, `/admin/login` | 200 |
| 2 | Compat redirects `/`, `/game`, `/xi/bdk` | 308 → play/hub |
| 3 | Lobby brand / wallet balance | OK (`balanceMinor` observed) |
| 4 | Profile identity | OK |
| 5 | Hub → session create | OK |
| 6 | Play spin → round SETTLED | OK (`roundId` matched player) |
| 7 | Balance after spin | Decremented by bet |
| 8 | Wins history includes round | OK |
| 9 | VIP status | OK (placeholder levels) |
| 10 | Deposit channels readiness | NOT_PRODUCTION_READY |
| 11 | Deposit create → confirm (TEMP) | SUCCESS |
| 12 | Withdraw readiness + create hold | OK / UNDER_REVIEW |
| 13 | Admin login | 200 |
| 14 | **Admin players list + detail** | **200** (P0 fixed) |
| 15 | Admin deposits / withdrawals / audit | 200 |
| 16 | Headed PC shots lobby/hub/play | OK |
| 17 | Rankings API (extra probe) | **200** real aggregate (`total≥1`, masked nick) |

## Rankings FE

Hub modal wired to `RankingsPanel` → `GET /api/v1/game/rankings` (live 200 verified).

## Gaps (honest)

- Real Android/iPhone/Tablet FPS: **NOT TESTED**
- BR-005..007 / BR-009: **NOT_PRODUCTION_READY**
- `npm test` (bash pipefail path): use `npm run test:win` / `test:unit` on Windows
- Pre-existing unit fail: `hosting.json` D1 binding gate expects `null`, actual `'DB'` (1/315)

## Verdict

Same-player engineering chain: **PASS** for RC candidate.  
Money production: **Gate Pending**.

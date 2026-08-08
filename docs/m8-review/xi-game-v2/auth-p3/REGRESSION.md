# REGRESSION — Auth P3

| Area | Status | Evidence |
|------|--------|----------|
| P0 hydration / lang SSR | **PASS** | `xi-hydration-nav-p0` |
| `#gl` translateZ kept | **PASS** | hydration test + no Auth CSS on `#hud` |
| No `#hud` shell translateZ | **PASS** | hydration test |
| P1 GameClient keep-alive | **UNTOUCHED** | no edits to `game-client` / boot lifecycle this P3 |
| P2 lobby polish | **PRESERVED** | Auth entry additive in topbar; mythic styles additive |
| Hub / Play / Reel / Spin | **UNTOUCHED** | no m5 reel/spin/math edits |
| MoneyService / Ledger cores | **UNTOUCHED** | Auth calls `getAvailableBalance` only |
| Fake balances | **PASS** | Auth wallet = 0; seed only `dev-test-player` |
| Identity fail-closed | **PASS** | identity suite still green |
| Admin players list | **EXTENDED** | IP/device from `player_auth_sessions` (M8 + M9 sync) |

## Risk notes

- With `AB_ALLOW_TEST_IDENTITY=1`, game APIs still resolve DevTest when no Auth cookie — intentional harness path.
- PBKDF2 600k iterations ≈ 150–250ms/hash on Node — acceptable for Auth; Workers cost should be monitored.

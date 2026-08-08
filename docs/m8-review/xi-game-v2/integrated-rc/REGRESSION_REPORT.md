# REGRESSION_REPORT — Integrated RC

## Protected cores

No intentional edits to RNG / RTP / Math / Paytable / Spin orchestrator settlement / Round authority / Wallet-Ledger recovery. Integration = routes + brand comment + tests/docs + admin login page.

## P0 compositor

- `#gl { transform: translateZ(0) }` present
- `#hud` shell has **no** `translateZ(0)`
- Asserted by `xi-lobby-phase1` + `xi-integrated-rc` tests

## Gates

| Gate | Result |
|------|--------|
| `tests/xi-integrated-rc.test.mjs` | PASS |
| Focused unit (lobby/step4/5/deposit/vip/money/admin/m8 commercial) | PASS |
| `npm run test:unit` | **310/311** — 1 pre-existing fail: `r1-m5-identity-gate` expects hosting.json D1=`null`, actual=`DB` (wiring debt, not this pass) |
| `npm test` / `npm run build` / `npm run lint` | **BLOCKED** Windows CRLF `pipefail` in bash scripts |
| `tsc --noEmit` | Pre-existing vite/worker/cloudflare type debt |
| Phase C HTTP full-chain | **27/28** PASS (admin players 500) |
| Headed PC screenshots | OK (`screenshots/01-03`) |
| Android / iPhone / Tablet FPS | **NOT TESTED** |

## Route regression

`/` and `/game` no longer mount GameClient directly — redirect to play shell (same GameClient). Bookmarks preserved via 308.

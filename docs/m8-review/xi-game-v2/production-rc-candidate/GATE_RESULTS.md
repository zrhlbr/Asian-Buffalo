# GATE_RESULTS — Production RC Candidate

| Gate | Command | Exit | Notes |
|------|---------|------|-------|
| Unit tests | `npm run test:unit` / `test:win` | **1** | 314 pass / 1 fail: `hosting.json` expects `d1: null`, actual `'DB'` (pre-existing) |
| Lint (Windows) | `npm run lint:win` | **1** | Repo-wide legacy/docs noise; **scoped RC sources exit 0** |
| Build (Windows) | `npm run build:win` | **0** | vinext OK; `/api/v1/game/rankings` listed |
| tsc | `npx tsc --noEmit` | **2** | Pre-existing cloudflare/vinext/examples ambient |
| Whitespace | `git diff --check` | **0** | Clean |
| Full-chain smoke | `node docs/.../integrated-rc/_smoke-integrated.mjs` | **0** | **28/28 PASS** incl. admin players 200 |
| Rankings probe | `GET /api/v1/game/rankings?range=7d` | **200** | Real aggregate + masked nick |
| Bash `npm test` / `lint` / `build` | pipefail scripts | **N/A on native PS** | Use `*:win` equivalents (TECH_DEBT) |

## P0 verification

`admin.players.query` detailStatus=200 listStatus=200 (was 500/500).

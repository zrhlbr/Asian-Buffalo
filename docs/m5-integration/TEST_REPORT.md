# R1-M5 Integration — Automated Test Report

**Worktree:** `D:\Asian-Buffalo-R1-M5-Cursor-Clean`  
**Branch:** `feature/ab-r1-m5-integration`  
**Baseline HEAD:** `4049348f4b7673694de16e4ef55fd306c5b390c8`  
**Date:** 2026-08-06  

## Commands

```bash
# Unit suite (after build artifact present)
node --experimental-strip-types --test tests/*.test.mjs

# Build
npm run build
```

## Results

| Suite | Result |
|---|---|
| Full `tests/*.test.mjs` | **185 / 185 PASS** |
| `tests/r1-m5-integration.test.mjs` | **7 / 7 PASS** |
| `npm run build` (vinext verified) | **PASS** |
| Routes include `/api/v1/game/wallet/balance` | Confirmed in build output |

## Live formal-project smoke (single frontend)

Dev server: `npx vite --host 127.0.0.1 --port 5173` (formal repo only; Prototype tree not required).

| Check | Result |
|---|---|
| `POST /api/v1/game/sessions` | 200 — `mathVersionId=ab-math-1.0.0` |
| `GET /api/v1/game/wallet/balance` | 200 — `balanceMinor=100000` (DEV seed) |
| `POST /api/v1/game/spins` | 200 — grid **5×4**, lineWins server-side, balance updated |
| Browser spin | Balance `100060 → 100010` (bet 50), session retained |
| Language switch zh / en / my-MM | UI labels change; **balance/session/bet unchanged** |

## Guards covered by M5 tests

- Formal SymbolId set (no eagle/lotus ids)
- 5×4 / 50 lines
- Boot uses `FormalGameProvider` only (no Mock import)
- Formal provider hits Session/Spin/Round/Rules/Balance
- `winTier` absent from money/math modules
- Runtime identity fail-closed unless `AB_ALLOW_TEST_IDENTITY=1`

## Not committed / not pushed

Confirmed: HEAD remains `4049348`; no merge/push performed.

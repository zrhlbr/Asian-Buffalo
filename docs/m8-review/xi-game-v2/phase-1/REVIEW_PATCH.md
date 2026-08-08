# REVIEW_PATCH — XI GAME V2 Phase 1

**Patch file:** `AB-XI-GAME-V2-PHASE1-review.patch`  
**Scope:** Additive lobby only (`/xi`, `/xi/bdk`, `/game` alias, catalog API, `client/xi-lobby/*`).  
**Not included:** `client/m5/*`, admin, wallet/ledger/math mutations, commits.

## Apply (review machine)

```bash
git apply --check docs/m8-review/xi-game-v2/phase-1/AB-XI-GAME-V2-PHASE1-review.patch
git apply docs/m8-review/xi-game-v2/phase-1/AB-XI-GAME-V2-PHASE1-review.patch
```

If the working tree already contains these untracked files, use FILE_LIST + SHA256 instead of re-applying.

## Verify

```bash
node --experimental-strip-types --test tests/xi-lobby-phase1.test.mjs
npx eslint client/xi-lobby app/xi app/game/page.tsx app/api/v1/lobby lib/lobby-catalog.ts
npx vinext build
# optional headed smoke (dev server required):
node docs/m8-review/xi-game-v2/phase-1/_smoke-lobby.mjs http://127.0.0.1:5173
```

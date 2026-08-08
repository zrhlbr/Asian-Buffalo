# ROLLBACK — Step 5

## Code rollback (no commit was made)

1. Revert whitelist diffs:
   - `lib/payment-readiness.ts` (delete)
   - `lib/deposit-service.ts`, `lib/withdrawal-service.ts`, `lib/wallet-commerce-bootstrap.ts`
   - `app/api/v1/game/deposit/channels/route.ts`, `app/api/v1/game/withdraw/route.ts`
   - `client/xi-lobby/api.ts`, `commerce-panels.tsx`, `i18n.ts`, `lobby.css` (readiness bits)
   - `tests/step5-finalize.test.mjs` (delete)
2. Leave Step 1–4 tables/routes intact.
3. Docs under `docs/m8-review/xi-game-v2/step-5-finalize/` may remain as historical package.

## Data

Additive `productionReady` flags in seeded JSON are backward-compatible (default false). No DROP / destructive migration.

## Do not

- Hard-reset shared branches
- Deploy / push as part of rollback unless ordered

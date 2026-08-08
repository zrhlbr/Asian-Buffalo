# REVIEW_PATCH.md

**Milestone:** Screenshot-feature completeness (Phases 1–4 solid; 5–11 contracts)  
**Baseline:** `9654d4194d2db801467af34cef1ddc5650fd310f`  
**Rule:** Development Rule V1.1  
**Git:** NO commit / merge / push / deploy performed

## Summary
Additive Profile/VIP/Rewards commerce sidecars + in-game black-gold/purple-gold modals + admin VIP module. Money credits only via MoneyService. P0 blackscreen stacking preserved.

## Patch materialization
Working tree diffs under FILE_LIST.md. SHA-256: `SHA256.txt`.

## Rollback
1. Remove new API routes + `lib/player-*` / `lib/vip-*` / `overlays.ts`  
2. Revert listed modified files  
3. Leave IF NOT EXISTS sidecar tables (harmless) or ignore  
4. Restore M9 copies if needed from baseline

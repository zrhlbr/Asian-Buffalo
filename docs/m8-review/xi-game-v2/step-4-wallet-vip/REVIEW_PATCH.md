# REVIEW_PATCH — Step 4

- Binary patch: `AB-XI-STEP4-WALLET-VIP-review.patch`
- SHA-256 list: `SHA256.txt`
- File list: `FILE_LIST.md`
- Git status snapshot: `GIT_STATUS_NOTE.txt`
- `git diff --check`: `GIT_DIFF_CHECK.txt` (honest — report any pre-existing whitespace noise)

**Rollback (presentation-safe):**

1. Remove new player API routes under `deposit/`, `withdraw/`, `activities/`, `checkin/`, `wins/`, `wallet/route.ts`  
2. Revert FE modal wiring in lobby/hub/overlays to prior stubs  
3. Remove admin modules deposits/withdrawals/activities + NAV entries  
4. Leave additive IF NOT EXISTS tables in place (safe)  
5. Do **not** touch reel / `#hud` / spin paths during rollback

# R1-M9 Admin — Baseline Migration Report

## Verdict

Phase A admin console is **safely on the formal M5 baseline**  
`9654d4194d2db801467af34cef1ddc5650fd310f`.

Worktree: `D:\Asian-Buffalo-R1-M9-Cursor-Clean`  
Branch: `feature/ab-r1-m9-admin` (detached from M5 SHA, not committed)

## What was migrated

Additive admin surface only (no Wallet / Ledger / Math / RTP core edits):

| Area | Path |
|---|---|
| UI shell + modules | `app/admin/**` |
| Catch-all API route | `app/api/admin/[...slug]/route.ts` |
| Auth / RBAC / bootstrap / queries / i18n | `lib/admin/**` |
| Automated tests | `tests/r1-m7-admin.test.mjs` (+ M9 extensions) |

Source of truth for Phase A port: M8 Cursor Clean admin tree (already living on `9654d41`), with Kimi extras merged (`ROLE_PERMISSIONS` export, admin audit/matrix/stats).

## Safety invariants preserved

- No Commit / Merge / Push / PR performed.
- No balance mutation endpoints.
- No settled-round mutation endpoints.
- No FROZEN math mutation endpoints.
- Wallet / Ledger / Math cores untouched.
- Only game-table write remains `players.status` freeze/unfreeze (audited + reason required).

## Verification

```text
node --experimental-strip-types --test tests/r1-m7-admin.test.mjs
```

Expected: Phase A suite green on this baseline; M9 additive cases cover sessions/spins/reports/monitor/admin stats.

## Note on old baseline `4049348`

`4049348` is the M4 durable-ledger commit. Formal admin Phase A development that previously sat near that older line must continue only from this M9 worktree at `9654d41`.

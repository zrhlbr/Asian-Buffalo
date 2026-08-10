# R1-M9 Admin — Rollback Notes

Baseline: `9654d4194d2db801467af34cef1ddc5650fd310f`

## Scope

All M9 admin work is additive under:

- `app/admin/**`
- `app/api/admin/**`
- `lib/admin/**`
- `tests/r1-m7-admin.test.mjs`
- `docs/m9-admin/**`

No Wallet / Ledger / Math core files were modified.

## Rollback (uncommitted worktree)

If changes must be discarded:

```bash
# Review first
git status
git diff --stat

# Discard only admin additive paths (example)
git checkout -- lib/admin app/admin app/api/admin tests/r1-m7-admin.test.mjs docs/m9-admin
```

Or reset the worktree to baseline (destructive — only if ordered):

```bash
git reset --hard 9654d4194d2db801467af34cef1ddc5650fd310f
```

## Partial feature rollback

| Feature | Files to revert |
|---|---|
| Wallet intent detail | `admin-api.ts` route + `wallet.tsx` modal; query may stay |
| Reports cohorts | `getOpsReport` block + `reports.tsx` |
| Announcement draft JSON | `handleAnnouncementCreate` + `system.tsx` form |
| Risk HF / multi-device note | `getRiskSignals` additions + `risk.tsx` banner |

## Verify after rollback

```bash
node --experimental-strip-types --test tests/r1-m7-admin.test.mjs
```

# R1-M5 Integration — Rollback Plan

**Baseline (safe restore point):** `4049348f4b7673694de16e4ef55fd306c5b390c8`  
**Branch:** `feature/ab-r1-m5-integration`  
**Nothing has been committed/pushed for M5.**

## Option A — Discard all uncommitted M5 work (preferred)

```powershell
cd D:\Asian-Buffalo-R1-M5-Cursor-Clean
$env:GIT_TERMINAL_PROMPT = "0"
git reset --hard 4049348f4b7673694de16e4ef55fd306c5b390c8
git clean -fdx -e node_modules -e .wrangler
```

Result: tree identical to M4 commit; M5 presentation/API wiring gone.

## Option B — Remove worktree entirely

```powershell
git -C D:\Asian-Buffalo worktree remove --force D:\Asian-Buffalo-R1-M5-Cursor-Clean
git -C D:\Asian-Buffalo branch -D feature/ab-r1-m5-integration
```

## Option C — Keep branch, revert specific areas

Delete/restore only:

- `client/m5/`
- `app/game-client.tsx`, `app/globals.css`, `app/page.tsx`, `app/layout.tsx`
- `app/api/v1/game/**` route wiring changes
- `lib/runtime-identity.ts`, `lib/dev-*-bootstrap.ts`, `lib/route-test-services.ts`
- `lib/api-handlers.ts` (`resolvePlayerForBalance` only)
- `worker/index.ts` env bridge
- `vite.config.ts` / `.openai/hosting.json` / `package.json` three dep
- `tests/r1-m5-integration.test.mjs`, identity test expectation updates
- `docs/m5-integration/`

Then `git checkout --` any remaining tracked files from `4049348`.

## Production safety note

If a preview deploy accidentally enabled `AB_ALLOW_TEST_IDENTITY=1`, unset it immediately. Without the flag, `createRuntimeIdentityProvider()` returns the fail-closed production provider.

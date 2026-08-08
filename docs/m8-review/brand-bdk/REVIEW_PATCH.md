# Brand Rename — REVIEW PATCH (Bull Demon King / 牛魔王 / BDK)

**Rule:** Development Rule V1.1 — HIGHEST  
**Commit/Push/PR:** forbidden (not performed)  
**Milestone:** User-visible product brand chrome only

## Summary

Renamed user-facing product brand from **Asian Buffalo / 亚洲水牛** to:

- **zh:** 牛魔王  
- **en:** Bull Demon King (full) / **BDK** (compact HUD `gameTitle`)  
- **my:** Bull Demon King / BDK (no standard MY brand — documented)

Synced player+shared workspace (M8) and admin-visible strings in M9.

## Files changed

### M8 (`Asian-Buffalo-R1-M8-Cursor-Clean`) — 23 content files + delivery docs

- `client/m5/i18n.ts`
- `app/layout.tsx`
- `app/game-client.tsx`
- `app/admin/layout.tsx`
- `app/admin/admin-app.tsx`
- `lib/admin/i18n.ts`
- `package.json` (`displayName` only)
- `public/avatars/ab-avatar-01.svg` … `ab-avatar-16.svg` (aria-label)
- `docs/m8-review/brand-bdk/*` (this package)

### M9 (`Asian-Buffalo-R1-M9-Cursor-Clean`) — 7 content files + delivery docs

- Same relative paths for i18n / layout / game-client / admin / package `displayName`
- No `public/avatars` tree in M9

## Sample renames

| Before | After |
|--------|-------|
| Asian Buffalo | Bull Demon King / BDK |
| 亚洲水牛 | 牛魔王 |
| Asian Buffalo · Admin | Bull Demon King · Admin |
| Asian Buffalo Web Game | Bull Demon King |

## Not changed

npm package name, routes, DB, env keys, math/wallet/ledger/spin, CSS shell, animal symbol ids (`buffalo`).

## Artifacts

| File | Purpose |
|------|---------|
| `MODULE_IMPACT_ANALYSIS.md` | Whitelist + out-of-scope |
| `FILE_LIST.txt` | Changed paths |
| `SHA256SUMS.txt` | Content hashes |
| `BEFORE_AFTER.md` | String samples |
| `REGRESSION_REPORT.md` | Pass/fail gates |
| `GIT_STATUS_NOTE.md` | Uncommitted status |
| `REVIEW_PATCH.md` | This summary |

## Regression

**PASS** — admin unit suite 14/14; whitelist clean of old brand; intentional leftovers documented.

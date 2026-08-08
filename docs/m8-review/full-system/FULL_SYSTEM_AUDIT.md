# Asian Buffalo — Full-System Warehouse Audit (Phase 1)

**Date:** 2026-08-07  
**Auditor:** full-system agent (end-to-end loop)  
**Formal M5 baseline SHA:** `9654d4194d2db801467af34cef1ddc5650fd310f`  
**Rules:** NO commit / merge / push / PR / production deploy. Presentation-only for visuals. Fail closed for money.

---

## 1. Current workspace(s)

| Role | Path | Notes |
|---|---|---|
| Player / M8 presentation (primary) | `D:\Asian-Buffalo-R1-M8-Cursor-Clean` | Clarity V2 + win-presentation present |
| Admin / M9 (primary) | `D:\Asian-Buffalo-R1-M9-Cursor-Clean` | More complete admin API/queries/i18n |
| Shared git object store | same repo via `git worktree` | 16 worktrees listed |

## 2. Branch

| Workspace | Branch / HEAD state |
|---|---|
| M8 | `feature/ab-r1-m8-cursor` |
| M9 | **detached HEAD** (HANDOFF claims `feature/ab-r1-m9-admin` — **not checked out**) |

## 3. HEAD

Both: `9654d4194d2db801467af34cef1ddc5650fd310f`  
Message: `feat(r1-m5): integrate official M5 visual prototype into production gameplay`

## 4. Git status (summary)

Both worktrees: **~276 dirty paths**, almost entirely uncommitted additive work on top of M5 baseline.

- M8: many `AM`/`MM` on player client + partial admin (staged + further unstaged).
- M9: mostly clean `A`/`M` staging of overlapping tree (admin more advanced; player lacks win-presentation).
- Secrets-adjacent: `.dev.vars` staged (`AB_ALLOW_TEST_IDENTITY=1`) — **do not commit**.

## 5. Git worktree list

```
D:/Asian-Buffalo                    7db2f6b (detached HEAD)
D:/Asian-Buffalo-M1-M3-I18n         756c7e6 (detached HEAD)
D:/Asian-Buffalo-M1-M3-I18n-Clean   756c7e6 (detached HEAD)
D:/Asian-Buffalo-R1-M3-Prep         756c7e6 (detached HEAD)
D:/Asian-Buffalo-R1-M4-Commit       4049348 [main]
D:/Asian-Buffalo-R1-M4-Cursor       756c7e6 (detached HEAD)
D:/Asian-Buffalo-R1-M4-Cursor-Clean 756c7e6 [feature/ab-m1-m3-i18n]
D:/Asian-Buffalo-R1-M4-Prep         7db2f6b [feature/ab-r1-m4-prep]
D:/Asian-Buffalo-R1-M5-Cursor       4049348 (detached HEAD)
D:/Asian-Buffalo-R1-M5-Cursor-Clean 9654d41 (detached HEAD)
D:/Asian-Buffalo-R1-M5-Kimi         4049348 (detached HEAD)
D:/Asian-Buffalo-R1-M6-Cursor-Clean 9654d41 (detached HEAD)
D:/Asian-Buffalo-R1-M7-Cursor-Clean 9654d41 (detached HEAD)
D:/Asian-Buffalo-R1-M7-Kimi         9654d41 [feature/ab-r1-m7-admin]
D:/Asian-Buffalo-R1-M8-Cursor-Clean 9654d41 [feature/ab-r1-m8-cursor]
D:/Asian-Buffalo-R1-M9-Cursor-Clean 9654d41 (detached HEAD)
```

## 6. Remote

| Name | URL |
|---|---|
| origin | `https://github.com/zrhlbr/Asian-Buffalo.git` |
| legacy | `https://git.chatgpt-team.site/.../appgprj_6a739f738b9c8191991a9c143b1bc6d9.git` |

## 7. M5 formal baseline

- Object type: `commit`
- `merge-base --is-ancestor` vs HEAD: **yes** (exit 0)
- Working trees are **exactly at** baseline commit; all M6–M9 work is **uncommitted** overlay.

## 8. M8 uncommitted player achievements (KEEP)

| Pack / feature | Evidence |
|---|---|
| Clarity V2 | `docs/m8-review/clarity-v2/*` + client quality/world/symbols/reels/styles |
| Win presentation ladder | `client/m5/win-presentation.ts` + `docs/m8-review/win-presentation/*` + tests |
| Reel timing ~6s (was 10s; updated 2026-08-07) | `client/m5/game/reel-timing.ts` (`NORMAL_SPIN_TOTAL_MS=6000`, stops 4.2–5.8, `SPIN_SPEED_MULT=1.35`) — pack `docs/m8-review/reel-timing-6s/` |
| Reel direction top→bottom | prior reel-direction pack + tests |
| Symbol life / FX animals | `symbol-life.ts`, `fx-animal` docs |
| Formal boot only | `boot.ts` imports `FormalGameProvider`; no Mock import |
| Quality degrade order | particles/grass/shadows/godRays/bloom/bg → renderScale last |
| i18n zh/my/en | `client/m5/i18n.ts` |
| Review patches (historical) | `AB-K1-R1-M8-*.patch`, clarity/reel packs under `docs/m8-review/` |

**M8-only (not in M9):** `win-presentation.ts`, clarity-v2 docs, win-presentation docs/tests.

## 9. M9 uncommitted admin achievements (KEEP / do not rewrite)

| Area | Status |
|---|---|
| Login / RBAC / audit / bootstrap | Present (`admin-auth`, `admin-bootstrap`, `admin-api`) |
| Dashboard (currency / sparklines) | Present (`byCurrency` etc. in M9 queries) |
| Players / sessions / rounds / spins | Modules + RO APIs |
| Wallet Intent RO + detail | **M9 has** `GET wallet/intents/:id` + `getWalletIntentDetail` — **M8 admin lacks** |
| Ledger RO + health | Present |
| Math RO | Present |
| Risk (HF spin + honest multi-device) | **M9 has** `HIGH_FREQ_SPIN` + `MULTI_DEVICE_UNAVAILABLE` — **M8 admin lacks** |
| Reports DAU/MAU/retention | **M9 has** — **M8 admin lacks** |
| Announcements + system monitor | Present in M9 |
| Admin i18n zh/en/my | Larger/complete in M9 |
| Tests | `tests/r1-m7-admin.test.mjs` (PROGRESS claims 19/19) |
| Docs | `docs/m9-admin/*` |

## 10. Current Review Patches

| Location | Packs |
|---|---|
| M8 `docs/m8-review/` | Main M8 patch, clarity, reel-direction, clarity-v2, win-presentation, fx-animal, reel-timing |
| M9 `docs/m9-admin/REVIEW_PATCH.md` | Admin handoff patch |
| This pack | `docs/m8-review/full-system/*` (this audit + delivery) |

## 11. Parallel write risk — **HIGH (PAUSE boundary)**

1. M8 and M9 are sibling worktrees of **one** repo at the **same** SHA.
2. Overlapping paths diverge in content (player + admin both dirty in both trees).
3. M8 has unstaged further edits on admin files that are **behind** M9 completeness.
4. M9 HANDOFF branch name ≠ actual detached HEAD.
5. Concurrent agent clarity work may still touch M8 `client/m5/*` (`AM`/`MM`).

**Pause decision:** Do **not** destructively sync/reset either worktree onto the other. Ownership fence:

- **Player presentation authority:** M8 only  
- **Admin authority:** M9 only  
- No `git reset --hard`, no wholesale copy of dirty trees across workspaces.

## 12. Workspace pollution — **CONFIRMED**

- M8 contains full `app/admin/**` + `lib/admin/**` (stale vs M9).
- M9 contains full M8 player client/docs (without clarity-v2 / win-presentation).
- Many historical worktrees (M4–M7) still attached — cognitive + accidental-edit risk.
- `.dev.vars` / test identity flag present locally.

## 13. Old Mock / Demo paths

| Path | Risk |
|---|---|
| `client/m5/mock-provider.ts` | Exists; **not** imported by `boot.ts` / `game-client.tsx` |
| `lib/game-engine.ts` `createDemoGrid` / `evaluateSpin` | Library helpers; production boot/tests assert not used in client |
| `lib/server-game-engine.ts` `evaluateSpinWithConfig` | **Server-authoritative** (expected) |
| `docs/m6-handoff/kimi-readonly/...` | Readonly snapshot with demo client — not production path |
| Capture scripts under `docs/m8-review/_capture*.mjs` | Use `window.__game` for QA capture only |

## 14. Duplicate runtimes

- Multiple Clean worktrees at `9654d41` (M5/M6/M7/M8/M9) with divergent dirty overlays → **duplicate runnable trees**.
- Vite/`vinext` dual packaging present in both M8/M9.
- Admin route `/admin` + `/api/admin/*` exists in both trees with different completeness.

## 15. Unfinished TODO/FIXME (high-signal)

Scan of `client/`, `lib/`, `app/` for `TODO|FIXME|HACK|XXX`: **no high-signal hits** in application code (docs excluded). Residual polish items are documented in M9 HANDOFF (announcement cron, Playwright smoke) — not blocking.

---

## Ownership fence (binding for Phases 2–7)

| Concern | Work in | Do not |
|---|---|---|
| Clarity / win FX / reel / HUD / player i18n | M8 | Overwrite with M9 player tree |
| Admin modules / RBAC / RO money views | M9 | Rewrite M9; downgrade from M8 stale admin |
| Frozen math / wallet / ledger cores | Read-only verify | Mutate money rules / DB migrations |
| Cross-tree sync | Document gaps only | Destructive merge |

## Pause items opened by Phase 1

1. **Concurrent workspace pollution** — documented; no cross-tree reset.  
2. **M9 detached HEAD** vs claimed `feature/ab-r1-m9-admin` — branch hygiene pause (no checkout/force without explicit order).  
3. **Production security clarity** — `.dev.vars` + `allowDebugHooks` DEV defaults need gate evidence (Phase 5).

---

## Next phases (executed after this audit)

- Phase 2: Core chain verify + safe fixes  
- Phase 3: Player presentation polish (M8 additive)  
- Phase 4: Admin gap-fill (M9 only)  
- Phase 5: Security scan  
- Phase 6: Gates  
- Phase 7: Delivery pack under this directory  

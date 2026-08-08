# PRE_MERGE_SNAPSHOT — 《西游戏》Steps 1–5 Integrated RC

**Captured before structural integration edits.**  
**Policy:** No Commit / Push / Merge main / Production Deploy in this pass.

## Workspace

| Field | Value |
|-------|--------|
| Primary workspace | `D:\Asian-Buffalo-R1-M8-Cursor-Clean` |
| Branch | `feature/ab-r1-m8-cursor` |
| HEAD | `9654d4194d2db801467af34cef1ddc5650fd310f` |
| HEAD subject | `feat(r1-m5): integrate official M5 visual prototype into production gameplay` |
| Admin workspace | `D:\Asian-Buffalo-R1-M9-Cursor-Clean` |
| Admin HEAD | `9654d4194d2db801467af34cef1ddc5650fd310f` (detached; same tree base) |
| Admin status | Parallel dirty tree (M9 admin modules + shared M8 drift) — **parallel-write risk** |

## Git status (primary, pre-edit)

- Index + worktree heavily dirty from Steps 1–5 + prior M8 commercial work (staged `A`/`M`/`AM`/`MM` + many `??` untracked).
- Full dumps preserved beside this file:
  - `_git-status-pre.txt`
  - `_git-diff-stat-pre.txt`
  - `_git-name-status-pre.txt`
  - `_git-worktree-pre.txt`
- Tracked diff --stat (pre-edit): **54 files, +8192 / −734** (does not include untracked Step4/5 commerce libs, admin modules, xi routes, tests, docs).

## Worktree list (risk)

Multiple worktrees share `9654d41` or older bases (`M5`/`M6`/`M7`/`M8`/`M9` Clean + Kimi).  
**Parallel-write risk: HIGH** — especially `D:/Asian-Buffalo-R1-M9-Cursor-Clean` (detached HEAD, dirty overlapping admin/commerce paths). Integration edits stay **primary M8 only**; do not sync-write M9 in this pass unless matrix check requires read-only compare.

## Step 1–5 patch / SHA pointers (accepted modules — DO NOT REWRITE)

| Step | Folder | SHA256 | Review patch / note |
|------|--------|--------|---------------------|
| 1 Lobby | `docs/m8-review/xi-game-v2/step-1-lobby/` | `SHA256.txt` (lobby routes + xi-lobby shell) | `REVIEW_PATCH.md` |
| 2 BDK Hub | `docs/m8-review/xi-game-v2/step-2-bdk-hub/` | `SHA256.txt` | `AB-XI-STEP2-BDK-HUB-review.patch` + `REVIEW_PATCH.md` |
| 3 Play | `docs/m8-review/xi-game-v2/step-3-play/` | `SHA256.txt` | `REVIEW_PATCH.md` |
| 4 Wallet/VIP | `docs/m8-review/xi-game-v2/step-4-wallet-vip/` | `SHA256.txt` | `REVIEW_PATCH.md` |
| 5 Finalize | `docs/m8-review/xi-game-v2/step-5-finalize/` | `SHA256.txt` | `AB-XI-STEP5-FINALIZE-review.patch` + `REVIEW_PATCH.md` |

Each step also retains FILE_LIST / ACCEPTANCE_NOTE / smoke-results where present.

## Current test / smoke evidence (pre-integration)

| Gate | Pre-integration status |
|------|------------------------|
| Step1 smoke | `step-1-lobby/smoke-results.json` present |
| Step2 smoke | `step-2-bdk-hub/smoke-results.json` present |
| Step3 smoke | `step-3-play/smoke-results.json` present |
| Step5 smoke | `step-5-finalize/smoke-results.json` — lobby brand + NOT_PRODUCTION_READY banner PASS on `:5173` |
| `npm run test:unit` | Not re-run at snapshot time (will run in Phase C) |
| `npm test` / `npm run build` / `npm run lint` | Historically **BLOCKED** on Windows CRLF `pipefail` bash scripts |
| `tsc --noEmit` | Pre-existing vite/worker debt (Step5: Step paths clean) |
| Real-device FPS | **NOT TESTED** |
| Headed full-chain (login→spin→deposit→admin→withdraw) | Pending Phase C; honest BLOCKED if env cannot run |

## Integration intent (post-snapshot only)

1. Unify final routes (`/xi`, hub, play, `/admin`, `/admin/login`); `/` + `/game` → compat redirect to play (single GameClient stack).
2. Brand user-visible leftovers cleaned carefully (no docs/migrations/ID smash).
3. Confirm single player identity + single wallet ledger projection across lobby/hub/play/admin.
4. FE↔Admin matrix + i18n parity + COMPLETE_SYSTEM_RESPONSE_MATRIX (UI✅API❌ = incomplete).
5. Delivery pack under `docs/m8-review/xi-game-v2/integrated-rc/` with Review Patch + SHA256 + FILE_LIST.
6. **No** RNG/RTP/Math/Paytable/Spin/Round/Settlement core rewrite; pause if required.
7. Preserve P0 `#gl { transform: translateZ(0) }`; no `#hud` shell `translateZ`.
8. BR-005..007 remain configurable + `NOT_PRODUCTION_READY`.

## Protected cores (must not change without pause/report)

RNG / RTP / Math config / Paytable / Spin orchestrator settlement path / Round authority / Wallet-Ledger recovery / MoneyService debit-credit invariants.

## Snapshot completeness

- [x] Workspace / branch / HEAD
- [x] git status / diff --stat / name-status / worktree list dumps
- [x] Step1–5 SHA + patch pointers
- [x] Prior smoke pointers
- [x] Parallel-write risk noted (M9 + sibling worktrees)
- [ ] Integration Review Patch / SHA256 / FILE_LIST — produced **after** Phase B edits

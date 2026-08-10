# ADMIN-1C Baseline Freeze

**Frozen at:** 2026-08-09  
**Phase:** ADMIN-1C start (pre-dev)  
**Workspace:** `D:\Asian-Buffalo-R1-M9-Cursor-Clean`

| Item | Value |
|------|-------|
| Branch | `(detached HEAD)` |
| HEAD | `9654d4194d2db801467af34cef1ddc5650fd310f` |
| Worktree | Dirty (prior M9 Admin + ADMIN-1B + game work uncommitted) |
| ADMIN-1B | Delivered — `ADMIN_1B_FINAL_VERDICT.md` · READY FOR ADMIN-1C: YES |
| Admin Games routes | SPA modules: `games`, `gameOps`, `rounds`, `spins` (`rounds:view`) |
| Games API | `GET /api/admin/games`, `GET /api/admin/games/:id/ops` |
| Round / Spin API | `GET rounds` / `rounds/:id` · `GET spins` / `spins/:id` (Spin ≡ `game_rounds` alias) |
| RBAC | Colon style · Games/Rounds/Spins gated by `rounds:view` (no separate `games:*`) |
| DB | No `games` catalog table · `game_rounds` / `game_sessions` / `game_math_versions` / `ledger_transactions.round_id` |
| Money gate | CLOSED |
| S-18 | OPEN → ADMIN-1F |
| Wallet frozenMinor | PARTIAL → ADMIN-1D |

## Pre-1C gaps (extend, do not replace)

- Games list missing math version / today players / last activity / honest status model
- Game ops missing Math/RTP RO panel, health, anomaly entry
- Round/Spin missing date range + Game ID filter + stronger ledger recon UX
- Player game tab → Round deep-link incomplete

## Discipline

- READ ONLY against game / wallet / ledger / math
- No RNG / RTP / Math / Paytable / Spin Engine / Wallet / Ledger core edits
- No Migration · No Push / Merge / Rebase / Deploy

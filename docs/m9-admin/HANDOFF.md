# R1-M9 Admin — Cursor Handoff Pack

## Workspace

- Path: `D:\Asian-Buffalo-R1-M9-Cursor-Clean`
- Git HEAD: `9654d4194d2db801467af34cef1ddc5650fd310f`
- Branch: `feature/ab-r1-m9-admin`
- Do **not** Commit / Merge / Push / PR unless explicitly ordered.

## Default login (bootstrap)

- Username: `admin`
- Password: `admin123`
- Role: `SUPER_ADMIN` (fail-closed seed)

## Routes

- UI: `/admin`
- API: `/api/admin/*`

## Module map (Phase A preserved + B–F additive)

| # | Module | UI | API |
|---|---|---|---|
| A | Login / RBAC / Audit / Dashboard / i18n | `/admin` | `login`, `me`, `dashboard`, `logs/*` |
| 1 | Players | `modules/players.tsx` | `players`, freeze/unfreeze |
| 2 | Sessions | `modules/sessions.tsx` | `sessions`, `sessions/:id` |
| 3 | Rounds | `modules/rounds.tsx` | `rounds`, `rounds/:id` |
| 4 | Spins | `modules/spins.tsx` | `spins`, `spins/:id` (alias of rounds) |
| 5 | Wallet Intent RO | `modules/wallet.tsx` | `wallet/intents`, `wallet/intents/:id`, `wallet/provider-ops` |
| 6 | Ledger RO + health | `modules/ledger.tsx` | `ledger/*`, `ledger/health` |
| 7 | Math RO | `modules/math.tsx` | `math-versions` |
| 8 | Risk | `modules/risk.tsx` | `risk/signals` |
| 9 | Ops reports | `modules/reports.tsx` | `reports/ops` |
| 10 | Announcements | `modules/system.tsx` | `system/announcements*` |
| 11 | System monitor | `modules/system.tsx` status tab | `system/status` |
| 12 | Admin stats | `modules/admins.tsx` | `admins`, `admins/stats`, `admins/matrix`, `admins/:id/audit` |
| 13 | i18n zh/en/my | `lib/admin/i18n.ts` | key-parity test |
| 14 | Responsive | `admin.css` @900/@640 | PC / tablet / phone |
| 15 | Tests | `tests/r1-m7-admin.test.mjs` | unit |
| 16 | This handoff | `docs/m9-admin/*` | — |

## Hard stops

- Do not rewrite Phase A shell/auth/bootstrap.
- Do not modify Wallet / Ledger / Math / RTP cores.
- Do not add balance/round/math write APIs.

## Progress

See `docs/m9-admin/PROGRESS.md`, `RISK.md`, `ROLLBACK.md`.

## Next suggested polish (optional)

- Auto-publish cron for announcement `publishAt` (currently metadata + manual publish).
- Playwright smoke for `/admin` login + nav if browser CI is available.
- Tune `HIGH_FREQ_SPIN` threshold with product.

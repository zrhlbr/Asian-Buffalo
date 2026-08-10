# ADMIN-1D Baseline Freeze

**Frozen at:** 2026-08-09  
**Phase:** ADMIN-1D start (pre-dev)  
**Workspace:** `D:\Asian-Buffalo-R1-M9-Cursor-Clean`

| Item | Value |
|------|-------|
| Branch | `(detached HEAD)` |
| HEAD | `9654d4194d2db801467af34cef1ddc5650fd310f` |
| Worktree | Dirty (prior M9 Admin + ADMIN-1B/1C + game work uncommitted) |
| ADMIN-1B | Delivered — READY FOR ADMIN-1C: YES |
| ADMIN-1C | Delivered — READY FOR ADMIN-1D: YES |
| Wallet module | Intents / provider-ops only (no Available/Frozen/Total center) |
| frozenMinor UI | PARTIAL (player detail only; dual formula risk) |
| Commerce frozen | `sumFrozenWithdrawals` — open withdrawal holds |
| Admin player frozen | ledger kind contains FROZEN/HOLD (often 0 vs commerce) |
| Money unit | Internal minor; UI `fmtMinor` = minor / 100 |
| Deposit confirm | Gate: `PROVIDER_NOT_CONFIGURED` unless `AB_ALLOW_TEST_IDENTITY=1` |
| wallet.adjust | ABSENT / BLOCKED |
| Money gate | PRODUCTION MONEY: NO / GATE CLOSED |
| S-18 | OPEN → ADMIN-1F |

## Authoritative frozenMinor (ADMIN-1D target)

```
availableMinor = ledger PLAYER_AVAILABLE (MoneyService.getAvailableBalance)
frozenMinor    = SUM(withdrawal_requests.amount_minor)
                 WHERE status IN (PENDING, UNDER_REVIEW, APPROVED, PAYING)
totalMinor     = availableMinor + frozenMinor
```

Do **not** invent frozen as Total − Available unless the model above is the documented definition (it is: total = available + frozen holds).

## Discipline

- READ ONLY against wallet / ledger balances for integrity
- No second Wallet / Ledger / Money model
- No RNG / RTP / Math / Paytable / Spin Engine core edits
- No Migration · No Push / Merge / Rebase / Deploy · No real money open

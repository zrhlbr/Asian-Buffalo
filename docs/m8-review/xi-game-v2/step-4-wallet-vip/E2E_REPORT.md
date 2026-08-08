# E2E_REPORT — Step 4

## Automated (this session)

| Suite | Result |
|-------|--------|
| `tests/deposit-withdraw.test.mjs` | **PASS** 4/4 |
| `tests/activity-checkin.test.mjs` | **PASS** 2/2 |
| `tests/step4-wallet-vip.test.mjs` | **PASS** 3/3 |
| `tests/vip-rewards.test.mjs` | **PASS** 3/3 |
| `tests/r1-m7-admin.test.mjs` | **PASS** 14/14 |
| Combined focused (23) | **PASS** 23/0 |

## Scenario map (brief 1–25)

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Wallet available read | PASS | getWalletSnapshot / balance route |
| 2 | Frozen reflects open withdraw | PASS | step4-wallet-vip test |
| 3 | Recent moves list | PASS | snapshot recentMoves |
| 4 | Deposit preset only | PASS | non-preset rejected |
| 5 | Deposit create idempotent | PASS | deposit-withdraw test |
| 6 | Deposit confirm credits once | PASS | double confirm alreadyCredited |
| 7 | Cross-player deposit forbidden | PASS | FORBIDDEN |
| 8 | Deposit expired fail-closed | CODE | confirmDepositOrder expires path |
| 9 | Withdraw hold debit | PASS | balance drops |
| 10 | Withdraw reject releases | PASS | balance restored |
| 11 | Withdraw approve+pay | PASS | stays debited, PAID |
| 12 | Withdraw anti-overdraw | PASS | INSUFFICIENT_BALANCE |
| 13 | Withdraw cancel release | CODE | cancelWithdrawal |
| 14 | VIP levels real data | PASS | reuse + fetchVipLevels |
| 15 | VIP chest claim idempotent | PASS | vip-rewards test |
| 16 | Inactive VIP cannot claim | PASS | vip-rewards test |
| 17 | Activity claim | PASS | activity-checkin |
| 18 | Expired activity blocked | PASS | EXPIRED |
| 19 | Check-in once/day | PASS | alreadyClaimed |
| 20 | Win history RO | PASS | empty for new player |
| 21 | Admin deposit confirm RBAC | CODE | deposit:manage + reason |
| 22 | Admin withdraw review RBAC | PASS | roleHasPermission matrix |
| 23 | Admin activity manage | CODE | activities POST + audit |
| 24 | Client cannot forge amount | PASS | FORBIDDEN_FIELD / preset check |
| 25 | Provider live without secrets | FAIL-CLOSED | BR-007 503 without test identity |

## Headed capture

See `BLOCKED_CAPTURE.md` — no headed browser session in this run. Step1/2/3 smoke scripts remain available for regression.

## Full `npm test`

**BLOCKED on Windows shell:** `scripts/build-verified.sh` fails (`set: pipefail` CRLF). Unit tests run via `node --experimental-strip-types --test tests/*.test.mjs`. Pre-existing failures observed outside Step 4 scope: `xi-lobby-phase1` expects `/xi/bdk` (now `/xi/bull-demon-king`); commercial comment was restored to match.

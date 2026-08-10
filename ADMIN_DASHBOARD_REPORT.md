# ADMIN_DASHBOARD_REPORT

## Summary
Dashboard reads live admin metrics from `GET /api/admin/dashboard` — no frontend fake numbers.

## Metrics
| Metric | Source |
|--------|--------|
| totalPlayers | `COUNT(players)` |
| todayNew | players created today |
| onlineNow | OPEN sessions not expired |
| todayActive | distinct players with rounds today |
| todayBet / payout / profit | settled rounds today |
| todayDepositCount / todayWithdrawCount / pendingWithdrawCount | commerce tables (0 if absent) |
| openRoundCount | PENDING rounds |
| system/ledger/wallet health | real health queries + probes |

## Charts
- 24h hourly spins / bet / payout
- byCurrency today
- sparklineSpins
- **trend7d**: active, new, bet, payout, profit (last 7 days)

## Gaps
- Production deploy of this round not performed.
- “Room” remains currency proxy (no room table).

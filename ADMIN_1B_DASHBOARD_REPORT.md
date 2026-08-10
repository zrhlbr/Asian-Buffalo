# ADMIN_1B_DASHBOARD_REPORT

**Date:** 2026-08-09  
**API:** `GET /api/admin/dashboard` → `getDashboardMetrics`  
**Cache:** 8s in-process TTL (`cached` flag)

## Metric → API → Service → DB

| Metric | API field | Service | DB source | Availability |
|--------|-----------|---------|-----------|--------------|
| 总玩家 | `metrics.totalPlayers` | admin-queries | `players` COUNT | OK |
| 今日新增 | `metrics.todayNew` | admin-queries | `players.created_at=today` | OK |
| 当前在线 | `metrics.onlineNow` | admin-queries | OPEN unexpired `game_sessions` | OK |
| 今日登录 | `metrics.todayLoginPlayers` | admin-queries | `player_profiles.last_login_at=today` | OK / NOT_AVAILABLE |
| 今日活跃 | `metrics.todayActivePlayers` | admin-queries | union(login, rounds) or rounds fallback | OK |
| 今日游戏玩家 | `metrics.todayGamePlayers` | admin-queries | DISTINCT `game_rounds.player_id` today | OK |
| 今日 Round | `metrics.todayRounds` | admin-queries | `game_rounds` count today | OK |
| 今日 Spin | `metrics.todaySpins` | admin-queries | same as rounds (`spin≡round`) | OK |
| 今日投注/派奖/净 | `metrics.todayBet/Payout/Profit` | admin-queries | settled rounds sums | OK / ERROR |

## Honesty rules
- No mock / random / demo numbers.
- `OK` + value `0` ≠ `NOT_AVAILABLE` ≠ `ERROR`.
- API failure in UI shows ErrorBox; does not invent zeros.
- `sources` map exposed for each KPI.
- 7d trends: new / active / gamePlayers / rounds — real spine, zeros allowed.

## Performance
- Single summary API; 8s short cache; 10s UI refresh optional.

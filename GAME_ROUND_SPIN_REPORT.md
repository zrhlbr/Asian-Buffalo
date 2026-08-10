# GAME_ROUND_SPIN_REPORT

## Rounds / Spins — CONNECTED (RO)
- Spins are product alias of `game_rounds`.
- List/detail show bet/win/currency/status/outcome extract (grid, scatter, wild, multiplier).
- Admin **cannot** mutate spin result / RNG / math.

## Games — CONNECTED*
- `GET /api/admin/games` — official 牛魔王 entry + online/today aggregates.
- Enable/maintenance: only via existing system maintenance config if exposed; no RTP/RNG edit UI.

## 牛魔王 Ops — CONNECTED*
- `GET /api/admin/games/bull-demon-king/ops`
- Today: spins, players, bet, win, freeGames, jackpot-tier event counts (best-effort from outcome_json; 0 if absent).
- No force-win / manual award.

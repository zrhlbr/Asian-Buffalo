# ADMIN_1C_SPINS_REPORT

## Model
Spin is the **product alias** of `game_rounds` (1:1). Admin cannot mutate settlement / RNG / math.

## API
- `GET /api/admin/spins` — same list engine as rounds (pagination + search/filter/date/gameId).
- `GET /api/admin/spins/:id` — same detail as round + audit `spins.detail.view`.

## UI
List: Spin ID · Round ID · Player · Game ID · Bet · Win · Result Summary · Timestamp  
Detail: Bet/Win/Net · balances · Result (stored outcome_json only) · Ledger Reference · links to Round / Player / Ledger / Session  
Search inputs debounced (350ms).

## Verdict
SPIN LIST: **YES** · SPIN DETAIL: **YES** · ROUND → SPIN TRACE: **YES** · SPIN → LEDGER REFERENCE: **YES**

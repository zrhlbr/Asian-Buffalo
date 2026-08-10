# ADMIN_1C_ROUNDS_REPORT

## API
- `GET /api/admin/rounds` — server-side pagination; search (Round/Player/Session/idempotency); filters: status, playerId, sessionId, gameId, from/to (max **31 days**, auto-capped).
- `GET /api/admin/rounds/:id` — detail + ledger references + RO reconciliation + audit `rounds.detail.view`.

## List columns
Round ID · Game ID · Player ID · Bet · Win · Net · Status · Start · End

## Detail
Round/Game/Player/Session(masked) · Status · Bet/Win/Net · Balance Before (**DERIVED**, not DB column) · Balance After · Spin Count (=1, ROUND_ALIAS) · Ledger Reference · outcome grid RO · recon issues.

## Trace
Round → Player / Spin / Session / Wallet / Ledger  
Player game tab → Round (row click)

## Verdict
ROUND LIST: **YES** · ROUND DETAIL: **YES** · PLAYER → ROUND TRACE: **YES**

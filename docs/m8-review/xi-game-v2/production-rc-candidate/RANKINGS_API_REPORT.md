# RANKINGS_API_REPORT

## Status

**Wired: YES** — UI + API + unit tests.

## Contract

`GET /api/v1/game/rankings?range=today|7d|30d&limit=&offset=`

Auth: `resolveActivePlayer` (same commerce gate as wins/wallet).

Response:

```json
{
  "range": "7d",
  "game": "bull-demon-king",
  "total": 12,
  "limit": 20,
  "offset": 0,
  "generatedAt": "...",
  "cacheTtlSeconds": 30,
  "items": [
    {
      "rank": 1,
      "playerIdMasked": "al***ce",
      "nicknameMasked": "Al***er",
      "winAmountMinor": 6500,
      "currency": "MMK",
      "game": "bull-demon-king",
      "range": "7d"
    }
  ]
}
```

## Aggregate source

- Table: `game_rounds`
- Filter: `status = 'SETTLED'` AND `total_win_minor > 0` AND `created_at >= rangeStart`
- Group: `player_id` · `SUM(total_win_minor)` · join `players` + `player_profiles`
- Ranges: UTC day start (`today`), rolling `7d` / `30d`

## Privacy / cache

- Nickname + playerId masked server-side (never full id/nick in payload)
- In-process TTL cache 30s + `Cache-Control: private, max-age=30`

## FE

- `RankingsPanel` in hub rankings modal (`bdk-hub.tsx`)
- Range tabs Today / 7D / 30D · i18n zh/en/my-MM
- `fetchRankings` in `client/xi-lobby/api.ts`

## Tests

`tests/rankings.test.mjs` — range parse, masking, aggregate ordering, pagination, empty board — **PASS**.

## Files

- `lib/rankings-service.ts` (new)
- `app/api/v1/game/rankings/route.ts` (new)
- `client/xi-lobby/api.ts`, `commerce-panels.tsx`, `bdk-hub.tsx`, `i18n.ts`
- `tests/rankings.test.mjs` (new)

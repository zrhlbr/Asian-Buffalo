# ADMIN_PLAYERS_500_ROOT_CAUSE

## One-liner

Live Admin Players HTTP 500 was caused by `runRaw` using better-sqlite3’s `prepare().all(...params)` against Cloudflare D1, which requires `prepare().bind(...params).all()` and returns `{ results }` — so `listPlayers`’s `.map` / bound `listRounds` threw; unit tests stayed green on SQLite.

## Evidence trail

| Observation | Implication |
|-------------|-------------|
| Unit `r1-m7-admin.test.mjs` green | better-sqlite3 path OK |
| Live smoke: deposits / withdrawals / audit **200** | Auth + RBAC + drizzle `db.all` OK |
| Live smoke: `GET /api/admin/players` + `/:id` **500**, body often empty/`{}` | Uncaught throw in handler (no try/catch envelope before fix) |
| `listPlayers` → `runRaw` → `rows.map(...)` | Non-array D1 result → TypeError |
| `getPlayerDetail` → `listRounds` with `player_id = ?` | D1 unbound / wrong bind API → SQL/driver error |
| `listAdminAuditLogs` also uses `runRaw` but often no binds + **no** `.map` | Could return 200 with odd `items` shape — smoke only checked status |

## Driver contract

| Driver | Correct | Broken (pre-fix) |
|--------|---------|-------------------|
| better-sqlite3 | `stmt.all(...params)` → `T[]` | N/A (worked) |
| D1 | `stmt.bind(...params).all()` → `{ results: T[] }` | `stmt.all(...params)` ignored binds / returned object |

Detection reused from `lib/db-atomic.ts`: D1 ≈ `$client.batch` present and `$client.transaction` absent.

## Fix (real, no fake rows)

1. Dual-driver `runRaw` in `lib/admin/admin-queries.ts` (M8 + M9 synced, identical SHA-256).
2. `handleAdminApi` try/catch → JSON `{ error: { code: INTERNAL_ERROR, message } }` on unexpected throws (visibility only; not a data fake).

## Expected after fix

| Case | Status |
|------|--------|
| List / search / page / filter | **200** + `{ total, page, pageSize, items }` |
| Detail existing player | **200** + player aggregates |
| Missing player | **404** `NOT_FOUND` |
| No / bad auth | **401** |
| Role without `players:view` | **403** |

## Files

- `lib/admin/admin-queries.ts`
- `lib/admin/admin-api.ts`
- M9 twin copies of the above (hash-matched)

# TEST REPORT (Wiring)

Date: 2026-08-07

## M8 focused (executed)

```
node --experimental-strip-types --test \
  tests/r1-m4-money.test.mjs \
  tests/r1-m8-wiring-d1-money.test.mjs \
  tests/wallet-adapter.test.mjs \
  tests/api-handlers.test.mjs
```

Result: **36/36 PASS**

## M9 admin (executed)

```
node --experimental-strip-types --test \
  tests/r1-m7-admin.test.mjs \
  tests/r1-m8-wiring-d1-money.test.mjs
```

Result: **PASS** (admin suite + wiring tests; password-hash cases are slow but green)

## Other gates

| Gate | Root | Result |
|---|---|---|
| Focused unit suites above | M8 | **36/36 PASS** |
| Admin + wiring | M9 | **PASS** |
| `git diff --check` | M8 | **PASS** (exit 0) |
| `tsc --noEmit` | M8 | **PARTIAL** — pre-existing errors remain (`cloudflare:workers`, examples/d1, vite.config, admins.tsx); **no remaining errors in new wiring files** after LedgerPosting/await fixes |
| `npm run lint` / full `npm test` | — | Not fully timed this session |
| Headed E2E capture | — | BLOCKED (`BLOCKED_CAPTURE.md`) |

## New tests

- `tests/r1-m8-wiring-d1-money.test.mjs` — D1 money persist + announcement filters

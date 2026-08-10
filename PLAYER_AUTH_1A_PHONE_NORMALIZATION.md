# PLAYER_AUTH_1A_PHONE_NORMALIZATION

**Date:** 2026-08-10 · Code: M8 `lib/phone-normalize.ts`

| Input | Canonical |
|---|---|
| `09xxxxxxxxx` | `+959xxxxxxxxx` |
| `959xxxxxxxxx` | `+959xxxxxxxxx` |
| `+959…` | unchanged |
| spaces / `-` | stripped |

Wired into register / login / forgot. Unique index on `player_auth_accounts.phone_e164`.

Tests: `phone-normalize.test.mjs` + `player-auth-1a-phone.test.mjs` → **PASS**

PHONE NORMALIZATION: **PASS**  
PHONE UNIQUE: **PASS**

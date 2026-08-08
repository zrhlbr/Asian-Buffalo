# TEST_REPORT — Auth P3

**Date:** 2026-08-08  
**Runner:** `node --experimental-strip-types --test`

## Auth suite

| Suite | Result |
|-------|--------|
| `tests/player-auth-p3.test.mjs` (5 cases) | **PASS** |
| `tests/xi-auth-i18n.test.mjs` | **PASS** |

Coverage:

- PBKDF2-SHA-256 hash + verify
- OTP stubs fail-closed / test-mode accept
- Phone register → login → wallet **0** → forgot reset
- Email register + case-insensitive login
- DevTest seed never applies to Auth player ids
- i18n zh/en/my parity including Auth keys

## Regression (spot)

| Suite | Result |
|-------|--------|
| `tests/identity.test.mjs` | **PASS** |
| `tests/xi-hydration-nav-p0.test.mjs` | **PASS** (`#gl` translateZ; no `#hud` shell translateZ) |
| `tests/player-profile.test.mjs` | **PASS** |

## Not run / blocked

| Item | Status |
|------|--------|
| Full `npm test` (includes build) | Not run this pass (time / scope) |
| Mobile browser smoke screenshots | **BLOCKED_CAPTURE** — no headed device session in this agent pass |
| Live SK SMS / SMTP | **N/A** — stubs NOT_PRODUCTION_READY |

## OTP test mode

Local `.dev.vars` includes `AB_AUTH_OTP_TEST_MODE=1` for harness only. Production must omit.

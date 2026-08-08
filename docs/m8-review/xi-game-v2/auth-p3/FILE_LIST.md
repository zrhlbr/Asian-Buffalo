# FILE_LIST — Auth P3

## New (M8)

| Path | Role |
|------|------|
| `lib/player-auth-bootstrap.ts` | Auth sidecar schema |
| `lib/player-password.ts` | PBKDF2 hash/verify |
| `lib/player-otp.ts` | OTP challenges + rate limits |
| `lib/otp-providers.ts` | SK SMS / SMTP stubs |
| `lib/player-session.ts` | Access/refresh cookies |
| `lib/player-auth-audit.ts` | Auth audit events |
| `lib/player-auth-service.ts` | Register/login/forgot/change |
| `lib/player-auth-api.ts` | HTTP handler |
| `app/api/v1/auth/[...slug]/route.ts` | Auth route entry |
| `app/xi/login/page.tsx` | Login page |
| `app/xi/register/page.tsx` | Register page |
| `app/xi/forgot/page.tsx` | Forgot page |
| `client/xi-lobby/auth-app.tsx` | Auth UI |
| `client/xi-lobby/auth-api.ts` | Client Auth fetch |
| `tests/player-auth-p3.test.mjs` | Unit/integration |
| `tests/xi-auth-i18n.test.mjs` | i18n parity |
| `docs/m8-review/xi-game-v2/auth-p3/**` | Delivery pack |

## Modified (M8)

| Path | Role |
|------|------|
| `lib/runtime-identity.ts` | Session-first composite identity |
| `lib/dev-test-bootstrap.ts` | Seed only fixed DevTest player |
| `lib/game-route-auth.ts` | Comment clarity |
| `worker/index.ts` | Bridge Auth OTP / provider env |
| `client/xi-lobby/api.ts` | Auth snapshot cache helpers |
| `client/xi-lobby/lobby-app.tsx` | Login/register/logout + hydrate |
| `client/xi-lobby/i18n.ts` | Auth strings zh/en/my |
| `client/xi-lobby/lobby.css` | Auth UI styles |
| `client/xi-lobby/nav.ts` | Auth routes |
| `lib/admin/admin-queries.ts` | IP/device from auth sessions |
| `lib/admin/i18n.ts` | `players.registeredAt` |
| `app/admin/modules/players.tsx` | Show register/IP/device |
| `.dev.vars` | `AB_AUTH_OTP_TEST_MODE=1` (local harness) |

## M9 sync

| Path | Role |
|------|------|
| `D:\Asian-Buffalo-R1-M9-Cursor-Clean\lib\admin\admin-queries.ts` | IP/device join parity |

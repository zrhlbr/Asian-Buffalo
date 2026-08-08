# AUTH_FLOW — 《西游戏》P3 Player Account System

```mermaid
flowchart TD
  A[Lobby /xi] -->|Login / Register| B{Channel}
  B -->|Phone| C[POST auth/register/start sms]
  B -->|Email| D[POST auth/register/start email]
  C --> E[SK SMS stub / test OTP]
  D --> F[SMTP stub / test OTP]
  E --> G[verify OTP]
  F --> G
  G --> H[set password]
  H --> I[Atomic init Player+Auth+Profile+VIP+Prefs]
  I --> J[MoneyService.getAvailableBalance → 0]
  J --> K[Create access+refresh session cookies]
  K --> L[/xi lobby hydrate avatar/nick/VIP/wallet]

  M[Login phone|email + password] --> N[Verify hash + rate limit]
  N --> K

  O[Forgot] --> P[OTP reset]
  P --> Q[Update password + revoke sessions]
  Q --> M
```

## Register (phone)

1. `POST /api/v1/auth/register/start` `{ channel:"sms", destination:"+959…" }`
2. OTP via **SK SMS stub** (fail-closed unless `AB_AUTH_OTP_TEST_MODE=1`)
3. `POST …/register/verify` → `POST …/register/complete` `{ password }`
4. Creates: `players` + `player_auth_accounts` + `player_profiles` + `player_vip` + `player_preferences` + session
5. Wallet available = **0** (no fake seed)
6. Set-Cookie `ab_player` + `ab_player_rt` → navigate `/xi`

## Register (email)

Same steps with `channel:"email"` and **SMTP stub**.

## Login

`POST /api/v1/auth/login` `{ channel, destination, password }` → session cookies → `/xi`

## Forgot password

`forgot/start` → OTP → `forgot/reset` → revoke sessions → re-login

## Identity resolution (game APIs)

1. Valid `ab_player` session → that `playerId`
2. Else if `AB_ALLOW_TEST_IDENTITY=1` → DevTest player
3. Else fail-closed 503

## OTP stub behavior

| Mode | Behavior |
|------|----------|
| Production (no env) | `PROVIDER_NOT_CONFIGURED` — fail-closed |
| `AB_AUTH_OTP_TEST_MODE=1` | No real send; fixed OTP `123456` |
| Live SK/SMTP env present | Stub still returns `PROVIDER_NOT_PRODUCTION_READY` (device/mailer not wired) |

**SK SMS / SMTP = NOT_PRODUCTION_READY stubs.** Never hardcode production secrets.

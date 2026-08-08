# ACCEPTANCE_NOTE — Auth P3

## Done

1. Register phone + email (OTP → password → atomic Player/Profile/Wallet@0/VIP/Session)
2. Login phone|email + password → `/xi`
3. Forgot password OTP reset → re-login
4. Security: PBKDF2-SHA-256+salt, change password, logout, refresh token, sessions, OTP/login rate limits, auth audit
5. Lobby topbar Auth entry + post-login hydrate without forced full reload
6. Admin players: register time, last login, IP, device, VIP, wallet, status
7. i18n zh/my/en including errors
8. SK SMS / SMTP interfaces as **NOT_PRODUCTION_READY** stubs (fail-closed / test OTP)

## Explicit non-goals (respected)

- No RNG/RTP/Math/Spin changes
- No MoneyService/Ledger rule rewrite
- No Deposit/Withdraw/VIP business rule changes
- No fake balances
- No commit / push / merge / deploy
- No formal DB migration

## Production conditions

- Omit `AB_ALLOW_TEST_IDENTITY` and `AB_AUTH_OTP_TEST_MODE`
- Wire real SK SMS device + SMTP only after Zhao approval (stubs refuse live send today)
- Auth cookies require HTTPS (`Secure` when `NODE_ENV=production`)

## Test conditions

- `AB_AUTH_OTP_TEST_MODE=1` → OTP `123456`
- Unit: `node --experimental-strip-types --test tests/player-auth-p3.test.mjs tests/xi-auth-i18n.test.mjs`

## DB change?

Additive sidecar `IF NOT EXISTS` only — **no** Drizzle migration / core ALTER.

## Push / Merge / Rebase?

**NO** (per order).

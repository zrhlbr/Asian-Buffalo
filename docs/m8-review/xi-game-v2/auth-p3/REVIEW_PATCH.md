# REVIEW_PATCH — Auth P3 Player Account System

## Summary

Additive player Auth for 《西游戏》: phone/email OTP register, password login, forgot/reset, session+refresh cookies, PBKDF2 password KDF, rate limits, audit log, Auth UI (mythic black-gold), lobby hydrate without forced reload, admin IP/device visibility. SK SMS + SMTP are fail-closed / test-mode stubs (**NOT_PRODUCTION_READY**). No Money/Ledger/RTP/Spin rewrites. **No commit / push / merge / deploy.**

## Password KDF note

Workers cannot load native bcrypt/argon2. Implemented **PBKDF2-SHA-256 (600k iterations) + random salt** via Web Crypto — Workers-safe production KDF. Documented in code and ACCEPTANCE_NOTE.

## Key APIs

| Method | Path |
|--------|------|
| POST | `/api/v1/auth/register/start` |
| POST | `/api/v1/auth/register/verify` |
| POST | `/api/v1/auth/register/complete` |
| POST | `/api/v1/auth/login` |
| POST | `/api/v1/auth/logout` |
| POST | `/api/v1/auth/refresh` |
| POST | `/api/v1/auth/forgot/start` |
| POST | `/api/v1/auth/forgot/verify` |
| POST | `/api/v1/auth/forgot/reset` |
| POST | `/api/v1/auth/password/change` |
| GET | `/api/v1/auth/me` |
| GET | `/api/v1/auth/sessions` |

## UI routes

- `/xi/login` · `/xi/register` · `/xi/forgot`

## Env

- `AB_AUTH_OTP_TEST_MODE=1` → fixed OTP `123456`
- Without it → OTP send fail-closed
- Existing `AB_ALLOW_TEST_IDENTITY` preserved

## DB

Additive sidecar tables only (`CREATE TABLE IF NOT EXISTS`). No formal Drizzle migration. DB gate respected.

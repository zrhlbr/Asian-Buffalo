# PLAYER_AUTH_1A_OTP_SECURITY

**Date:** 2026-08-10 · Code: M8 `lib/player-otp.ts`

## Generation / storage

- CSPRNG 6-digit via `crypto.getRandomValues`  
- TTL **10 minutes**（保留现有规范）  
- Store **SHA-256 hash only**（`otp:<code>`）  
- Production `AB_AUTH_OTP_TEST_MODE` must stay unset  

## Anti-bruteforce / bomb

| Control | Value |
|---|---|
| Max verify attempts | 5 → `OTP_LOCKED` |
| Per phone send | 5 / 15m |
| Per IP | 20 / 15m |
| Per device | 20 / 15m |
| Daily destination | 10 / 24h |
| Resend cooldown | 60s |
| Bridge limits | additional |

## Idempotency

Challenge id = Bridge `requestId`; insert before send; failed send consumes challenge.

## Verdict

OTP HASHED: **PASS**  
OTP RATE LIMIT: **PASS**  
SMS BOMB PROTECTION: **PASS**（code）

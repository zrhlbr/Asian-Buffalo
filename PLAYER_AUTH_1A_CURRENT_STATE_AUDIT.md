# PLAYER_AUTH_1A_CURRENT_STATE_AUDIT

> Canonical implementation lives on M8 branch `feature/player-auth-1a-m8`.  
> This copy is the M9 workspace delivery artifact for 赵总验收.

**Date (UTC):** 2026-08-10  
**Freeze baseline:**  
- M8 tag `xigame-admin-prod-20260810-lobby` = `01c4a83380d1408f1b0e4ce6aa44686c43562075`  
- M9 tag `xigame-admin-prod-20260810` = `0d1f194e6f16ffccfd0a96650b0bdd7898c3c84f`  
**Dev branches:** M8 `feature/player-auth-1a-m8` · M9 `feature/player-auth-1a`

## Executive verdict

| Layer | Status |
|---|---|
| Register / Login / Forgot UI | DONE |
| Auth API `/api/v1/auth/*` | DONE |
| OTP lifecycle (hash / TTL / attempts) | DONE |
| Session (opaque cookies) | DONE |
| Phone Myanmar normalize `09`→`+959` | DONE (this phase) |
| SMS Provider live | Bridge client DONE; SK smoke BLOCKED |
| Secure SMS Bridge code | DONE (`deploy/sms-bridge` on M8) |
| Production real OTP delivery | NO / BLOCKED (SK credentials MISSING) |
| `123456` Production | Must stay OFF |

See also M8 file: `PLAYER_AUTH_1A_CURRENT_STATE_AUDIT.md` (full audit written first, before code).

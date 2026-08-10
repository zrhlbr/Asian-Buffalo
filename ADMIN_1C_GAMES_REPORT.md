# ADMIN_1C_GAMES_REPORT

**Phase:** ADMIN-1C · Games  
**Date:** 2026-08-09  
**HEAD baseline:** `9654d4194d2db801467af34cef1ddc5650fd310f`

## Delivery
- Extended existing `GET /api/admin/games` + SPA `games` module (no second Games system).
- Single official title only: `bull-demon-king` / 牛魔王. No fake future games.
- List fields: Game ID, name, status, version, Math Version, online sessions, today players / rounds / spins / bet / win, last activity.
- Status derived from `admin_system_config.maintenance_mode` → `ACTIVE` | `MAINTENANCE` | `UNKNOWN`.

## CURRENT MODEL LIMITATION
- No `games` catalog table.
- No persisted `DISABLED` game enum (not forged in UI).
- `onlinePlayers` = **NOT AVAILABLE** (no presence). `onlineSessions` = OPEN unexpired `game_sessions` only — never last-login.
- Spin ≡ Round (1:1 alias).

## Math / RTP
- Version / Paytable / RTP identifiers from FROZEN `game_math_versions` config — **read-only**.
- No edit buttons / no write APIs.

## Verdict
GAMES LIST: **YES** · GAME DATA REAL: **YES**

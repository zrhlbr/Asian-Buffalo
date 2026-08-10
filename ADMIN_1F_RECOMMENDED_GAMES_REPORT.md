# ADMIN-1F Recommended Games Report

## Config

Table `admin_recommended_games`: game_id, sort_order, enabled, tag, cover_url, locales_json.

## Guard

Only `bull-demon-king` accepted (`INVALID_GAME` otherwise). Future titles must exist as official Game IDs first.

## APIs

- Admin: `GET/POST content/recommended-games`
- Player: `GET /api/v1/game/recommended-games` (enabled only)

## Lobby

M9 does not refactor Lobby UI. Player API is wired; M8 Lobby consumption may still be hardcoded → **PLAYER CONTENT SYNC: PARTIAL**.

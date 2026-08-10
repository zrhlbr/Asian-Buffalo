# ADMIN-1F Content Audit Report

## Audited actions

| Action | Target |
|--------|--------|
| announcement.create / publish / unpublish | announcement |
| banner.create / edit / publish / unpublish | banner |
| recommended_game.upsert | recommended_game |
| activity.upsert | player_activity |
| vip.level.upsert / vip.player.set | vip |

Publish/unpublish include before/after + reason + requestId + operator.

## Immutability

Audit logs remain append-only (no delete/rewrite API).

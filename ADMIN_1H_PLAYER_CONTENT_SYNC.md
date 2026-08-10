# ADMIN_1H_PLAYER_CONTENT_SYNC

**Date (UTC):** 2026-08-10  
**Cross-line note:** Lobby 接线在 M8 `client/xi-lobby/*`；Content public API 在 M9 routes（生产同镜像）。赵总 ADMIN-1H 批准范围内最小跨线。

## Before → After

| Content | Before | After |
|---|---|---|
| Announcements | API 但被 Auth 401 挡住 | **Public GET** → Lobby ticker |
| Banners | HARDCODED journey only + API 401 | **Public GET** + Lobby CMS strip（ACTIVE 才显示） |
| Recommended Games | HARDCODED `RECOMMENDED_GAMES` | **Public GET** + Lobby 行（fail-closed empty/error） |
| Activities | Auth API（玩家态） | 保持（非 CMS 公开列表） |

## Lifecycle（Production 实测）

| Step | Result |
|---|---|
| DRAFT banner | 玩家 API 不可见 |
| PUBLISH（zh/en/my 字符串 locales） | ACTIVE + 玩家可见 |
| UNPUBLISH | PAUSED + 玩家不可见 |
| S-18 incomplete publish | `CONTENT_I18N_INCOMPLETE` |
| Scheduler auto-publish | **PARTIAL / NOT AVAILABLE**（读时计算 ACTIVE/SCHEDULED；无独立 cron） |

## Locale

| Surface | Keys |
|---|---|
| Content API | `zh` / `en` / `my` strings |
| Lobby mapping | `zh-CN`→`zh`, `en`→`en`, `my-MM`→`my` |

## Files changed（minimal）

- M9: `app/api/v1/game/{announcements,banners,recommended-games}/route.ts`
- M8: `client/xi-lobby/api.ts`, `lobby-app.tsx`, `lobby.css`

## Verdict

**PLAYER CONTENT SYNC = PASS**

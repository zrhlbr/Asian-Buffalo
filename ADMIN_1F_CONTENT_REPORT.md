# ADMIN-1F Content Center Report

**Baseline HEAD:** `9654d4194d2db801467af34cef1ddc5650fd310f`  
**Date:** 2026-08-09  

## Surface

Admin → **Content Center** (`app/admin/modules/content.tsx`) with hub links to Announcements / Activities / VIP.

| Module | Status |
|--------|--------|
| Banner | YES (new) |
| Announcement | YES (extended + S-18 closed) |
| Activity | YES (trilingual + payout blocked) |
| VIP | YES (display + assign; high-risk fields blocked) |
| Recommended Games | YES (official game IDs only) |
| Static Content | PARTIAL (support/config remain under System) |

## Shared model

`lib/admin/admin-content-i18n.ts` — canonical `zh` / `en` / `my`; normalizes legacy `zh-CN` / `my-MM`.

## Meta honesty

`GET content/meta`:

- mediaUpload = **NOT_AVAILABLE** (HTTPS URL only)
- scheduling = **PARTIAL** (start/end computed at read; no fake cron)
- rewardPayout = **BLOCKED**
- brandLogoEditable = **false**

## Discipline

Extended existing announcement/VIP/activity stacks. No second CMS. No Lobby visual refactor (M8). Player APIs read the same tables.

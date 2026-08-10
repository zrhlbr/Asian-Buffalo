# ADMIN-1F Announcement Report

## Existing stack extended

Table `admin_announcements` + admin UI + player `listPlayerAnnouncements`.

Additive columns: `announcement_type`, `published_by`, `published_at`, `version`.  
Types: SYSTEM | ACTIVITY | MAINTENANCE | NOTICE.

Status model retained: **PUBLISHED / UNPUBLISHED** (draft = UNPUBLISHED).

## Create / Publish

- Create with locales; PUBLISHED create path asserts zh/en/my
- Publish/Unpublish require reason + audit before/after
- Frontend checks (Announcements module + System nested tab)
- Backend re-check on publish (S-18)

## Player sync

Player API filters PUBLISHED + schedule + **complete locales** (defense in depth). Incomplete published rows are not served.

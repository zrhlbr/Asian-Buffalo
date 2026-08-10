# ADMIN-1F S-18 Closure Report

## Gap (before)

`POST system/announcements/:id/publish` flipped status without re-validating zh/en/my.  
Client-only checks could be bypassed.

## Fix

`handleAnnouncementStatus` loads content, parses locales via shared model, rejects with:

```
CONTENT_I18N_INCOMPLETE
```

Create-as-PUBLISHED uses the same `assertLocalesComplete`.

## Proof (`tests/r1-m9-admin-1f.test.mjs`)

| Case | Result |
|------|--------|
| Draft with missing en/my → publish API | 400 CONTENT_I18N_INCOMPLETE |
| Complete zh/en/my → publish | 200 PUBLISHED |
| Audit `announcement.publish` | present |
| Player list shows complete locales | pass |

## Verdict

**S-18: CLOSED**

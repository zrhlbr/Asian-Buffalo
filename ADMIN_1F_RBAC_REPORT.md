# ADMIN-1F RBAC Report

## Permissions added

| Permission | Use |
|------------|-----|
| `content:view` | Content Center, banners, announcements list, recommended |
| `content:edit` | Create/edit draft banners, recommended, announcement create |
| `content:publish` | Publish/unpublish banner & announcement |

Announcement routes moved from `system:view/manage` to `content:*`.

## Roles

| Role | content:view | edit | publish |
|------|--------------|------|---------|
| SUPER_ADMIN | * | * | * |
| OPS / TECH | YES | YES | YES |
| SUPPORT / AUDIT / READONLY | YES | NO | NO |
| FINANCE / RISK | NO (except AUDIT via ALL_VIEW) | — | — |

Activity: `activity:view` / `activity:manage` retained.  
VIP: `vip:view` / `vip:manage` retained.

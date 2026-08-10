# ADMIN-1G Admin Sessions Report

## APIs

| Endpoint | Perm |
|----------|------|
| `GET admins/sessions` | `admins:sessions:view` |
| `GET admins/sessions/mine` | any logged-in admin |
| `POST admins/sessions/revoke` | `admins:sessions:revoke` |
| `POST admins/sessions/logout-others` | self only |

## Presentation

Session ID masked · IP masked · device summary · ACTIVE/EXPIRED

## Invalidation

Disable / reset password / change_role → delete sessions.  
Role re-read every request (opaque token, not JWT privilege cache).

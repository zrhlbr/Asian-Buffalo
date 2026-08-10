# ADMIN-1G Roles Report

## Model

Static `ROLE_PERMISSIONS` map — **not** DB-editable roles (honest `editable: false`).

`GET admins/roles` — roleId, name, adminCount, permissionCount, status.

## Role edit

No runtime permission editor this phase (avoids second RBAC system).  
Role assign on users via `change_role` with escalation + last-SUPER guards + session revoke.

# ADMIN-1G Security Report

## Security Center

`GET security/overview` + `app/admin/modules/security.tsx`

- Login failures: **NOT_AVAILABLE** (honest)
- Active sessions, disabled admins, SUPER count
- Recent permission-change audit rows
- Bootstrap env name only — password never exposed

## Protections tested

| Control | Result |
|---------|--------|
| Privilege escalation (OPS→SUPER create) | PASS (403) |
| Self disable/demote | PASS (SELF_OPERATION) |
| Last SUPER self-lock | PASS |
| Disabled admin session | PASS (401) |
| Session revoke | PASS |
| Secret leakage | PASS |
| Audit immutability | PASS (no delete API) |
| CS money write | PASS (FORBIDDEN) |

## Bootstrap

`AB_ADMIN_BOOTSTRAP_PASSWORD` — empty-table seed only; not in UI/API/logs/reports.

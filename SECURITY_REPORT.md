# SECURITY_REPORT

## Pass controls
- Admin session independent of players (`ab_admin`)
- Password: iterated salted SHA-256; bootstrap fail-closed without env/test gate
- RBAC on every admin API route
- Dangerous ops require reason + audit + IP
- No raw wallet/ledger/math balance UPDATE via admin
- Deposit confirm gated → PROVIDER_NOT_CONFIGURED
- REAL money fail-closed (`allowRealMoney=false`)
- Monitor/logs must not echo JWT/password/Authorization

## P0 watch
| Risk | Status |
|------|--------|
| Admin 500 on Players (D1 bind) | Mitigated earlier via runRaw dual-driver |
| Player accessing admin | Requires admin_users credentials |
| Secret in UI | Not in status payload |
| Money mis-open | Gate remains closed |

## Note
Workspace may contain `.dev.vars` locally — **do not commit/push** secrets.

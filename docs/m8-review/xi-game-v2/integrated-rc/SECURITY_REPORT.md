# SECURITY_REPORT — Integrated RC

## Preserved

- Fail-closed identity (no client-forged playerId)
- Spin/session validation schemas reject forbidden fields
- Deposit/withdraw reject client `balanceMinor` / status / fee fields
- Live provider confirm fail-closed without test gate
- Admin mutations require reason + audit (existing)
- RBAC permission checks on admin API

## Integration surface

- Compat redirects are 308 to same-origin play/hub only
- `/admin/login` does not weaken auth (same AdminApp gate)
- No secrets committed in this pass (`.dev.vars` remains local dirty; do not commit)

## Residual risks

- Test identity gate must stay off in production
- Admin bootstrap password `admin123` only under test gate
- Admin players live 500 — error path needs investigation (availability, not auth bypass observed)

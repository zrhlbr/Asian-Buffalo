# ADMIN-1E Audit Center Report

## Surface

Admin → Audit Center (`app/admin/modules/audit.tsx`)

| Tab | Source | Status |
|-----|--------|--------|
| Admin Action Audit | `admin_audit_logs` via `GET logs/admin` | IMPLEMENTED |
| Player / Game Security | `audit_events` via `GET logs/game` | PARTIAL (player security) |
| High-risk Security | `GET logs/security` | PARTIAL; admin login failures **NOT_AVAILABLE** |

## Admin Action fields

Audit ID · Operator · Role · Action · Target Type · Target ID · Before · After · Reason · IP (masked unless PII perm) · Timestamp · Request ID

Secrets scrubbed (password/hash/jwt/secret/otp/credentials → redacted).

## High-risk action trace

Confirmable via admin audit actions including:

- Player freeze / ban
- Session revoke
- Wallet sensitive access (existing logs)
- Money export — N/A (export FUTURE)
- Risk status change / risk notes
- Admin permission change (admins module)
- Announcement publish (existing; S-18 locale hardening still OPEN → ADMIN-1F)

## Immutability

- API is read-only list/detail — **no Edit / Delete / Rewrite endpoints** for audit tables
- Responses advertise `immutable: true`
- CSV export: `FUTURE` (export itself would be audited when added)
- **No P0 silent delete path found** in admin API for audit logs

## Filters / pagination

Operator · Player/Target ID · Action · Role · time — server-side pagination. Default time window clamped to avoid unbounded history scans.

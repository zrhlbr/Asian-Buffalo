# ADMIN_1B_PII_SECURITY_REPORT

## S-19 FIXED
IP / Device / UA default masking is server-side (`lib/admin/admin-pii.ts`).

| Field | Default | Full with |
|-------|---------|-----------|
| Phone | `09*****789` style | `players:pii:view` |
| Email | `zh***@example.com` | `players:pii:view` |
| IP | `192.168.*.*` / IPv6 prefix | `players:pii:view` |
| Device ID | partial mask | `players:pii:view` |
| User-Agent | `iPhone / Safari` summary | `players:pii:view` |
| Session ID | truncated | `players:sessions:view` or pii |

Search may match full phone/email; **response still masked** per role.

## Never returned
Password / hash / JWT / session secret / OTP.

## OPS default
No `players:pii:view` — cannot see raw IP/device/phone.
RISK / SUPER_ADMIN / AUDIT(+pii) as granted.

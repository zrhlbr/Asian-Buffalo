# SYSTEM_HEALTH_REPORT

## System status — CONNECTED
`GET /api/admin/system/status` returns:
- version (adminApi, baseline, module R1-M9)
- database `{ ok, latencyMs }` via timed `SELECT 1`
- probes `{ selectOne, ledgerQueryable }`
- ledger health, open sessions, pending rounds, wallet failures today, risk counts, admin stats

## Support / CS settings
Dedicated Support module reads `support_info` (Telegram/WhatsApp/Line/Email/Online). Missing → **Not Configured**.

## Secrets
UI/API status must not expose JWT/password/token/DB URL — not included in monitor payload.

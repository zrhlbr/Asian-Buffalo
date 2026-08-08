# AUDIT_REPORT — Step 5

## Sensitive admin ops (audited)

| Action | Audit key | Detail payload |
|--------|-----------|----------------|
| Login / logout | `admin.login` / `admin.logout` | IP only on login |
| Deposit config | `deposit.config.upsert` | config JSON (no secrets) |
| Deposit confirm | `deposit.confirm` | status / alreadyCredited |
| Withdraw config | `withdraw.config.upsert` | config JSON |
| Withdraw approve/reject/pay | `withdraw.*` | status |
| Activity upsert | `activity.upsert` | id / code |
| VIP assign / level | `vip.*` | level / status |
| Player freeze | existing | reason required |
| Admin CRUD / password reset | `admin.*` | **no password in detail** |

## Secrets policy

| Item | In audit logs? |
|------|----------------|
| Admin password / hash | **No** (reset logs action only) |
| Payment provider secrets | **N/A** — unset; must never log when added |
| Withdrawal account cipher | **No** — list APIs return masked only |
| Session tokens | **No** |

## Gap (document only)

When live PSP credentials are introduced, ensure callback handlers scrub Authorization headers and HMAC secrets from any audit/error detail (currently no live callback code).

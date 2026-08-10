# ADMIN_1B_AUDIT_REPORT

Reuses `admin_audit_logs` (no second audit system).

## Fields written
Operator · Role · Action · Target · Reason · IP · Timestamp · Request ID · Before · After · detail_json

Additive columns (IF NOT EXISTS / ALTER): `admin_role`, `request_id`, `before_json`, `after_json`.

## Covered high-risk (1B)
- player.freeze / unfreeze
- player.close / reopen (封禁映射)
- session.revoke
- admin.login

Response header: `x-request-id`.

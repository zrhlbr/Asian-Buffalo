# AUDIT_LOG_REPORT

## Connected actions (examples)
login/logout, player freeze/unfreeze/close/reopen, session revoke, deposit confirm, withdraw approve/reject/pay, activity upsert, announcement publish, system config, admin create/disable/role/password, vip set.

## Fields
admin_id, admin_username, action, target_type, target_id, reason, ip, detail_json, time.

## UI
Dedicated Audit module: `logs/admin` + `logs/game` (RO).  
No edit/delete APIs for audit rows.

# ADMIN-1G Audit Report

## New / reinforced actions

admin.create · admin.disable · admin.enable · admin.change_role · admin.reset_password  
admin.session.revoke · admin.sessions.logout_others  
ticket.create · ticket.update · ticket.reply · ticket.note  

All into existing `admin_audit_logs` — no second log store.

## Immutability

READ ONLY — no edit/delete endpoints for any role including SUPER_ADMIN.

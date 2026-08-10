# SESSION_REPORT

## View — CONNECTED
Player, session id, math version, free games, login/created, expires, status, aggregates, recent rounds.

## Revoke — CONNECTED*
- `POST /api/admin/sessions/:id/revoke` requires `system:manage` + reason.
- Sets **that** session to `REVOKED` only; audited.
- UI: DangerConfirm when `can("system:manage")`.

## Gaps
- IP/Device/Browser depend on optional auth sidecar (often null).
- Deep-links to player/spins fixed via ModuleView props.

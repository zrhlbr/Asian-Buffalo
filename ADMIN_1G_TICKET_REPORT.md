# ADMIN-1G Ticket Report

## Schema

`admin_tickets` + `admin_ticket_messages` (admin bootstrap sidecar)

## Model

| Field | Values |
|-------|--------|
| Status | OPEN · IN_PROGRESS · WAITING_PLAYER · RESOLVED · CLOSED |
| Priority | LOW · NORMAL · HIGH · URGENT |
| Category | ACCOUNT LOGIN GAME WALLET DEPOSIT WITHDRAWAL ACTIVITY VIP TECHNICAL OTHER |

## Workflow

Create → Assign (self) → Reply / Internal Note → Status changes → CLOSED (`support:manage`)

Audit: `ticket.create` / `ticket.update` / `ticket.reply` / `ticket.note` with before/after.

Related refs JSON: player / round / spin / ledger / deposit / withdrawal / riskEvent.

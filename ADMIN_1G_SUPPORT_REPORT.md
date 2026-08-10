# ADMIN-1G Customer Service Report

**Baseline HEAD:** `9654d4194d2db801467af34cef1ddc5650fd310f`  
**Date:** 2026-08-09  

## Surfaces

| Surface | Path | Notes |
|---------|------|-------|
| CS Tickets | `app/admin/modules/tickets.tsx` | List + detail + workflow |
| Channel config | `app/admin/modules/support.tsx` | Kept (Telegram/Email etc.) |
| API | `support/tickets*` | `support:view/reply/assign/manage` |

## Boundaries

- No default `players:pii:view` / `risk:pii:view` for SUPPORT
- Category WALLET/WITHDRAWAL does **not** grant money ops
- `SUPPORT_MONEY_FORBIDDEN` if credit/adjust/confirm attempted
- ATTACHMENT = **BLOCKED**; plain text only + sanitize
- Internal notes: `is_internal=1`, admin-only (no player ticket API)

## PLAYER CONTENT SYNC

Remains **PARTIAL** (M8 Lobby). Not modified this phase.

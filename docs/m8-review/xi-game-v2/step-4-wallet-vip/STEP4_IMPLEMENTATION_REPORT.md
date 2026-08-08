# Step 4 — Implementation Report

**Date:** 2026-08-07  
**Branch:** `feature/ab-r1-m8-cursor`  
**Baseline awareness:** `9654d419…`  
**STOP:** No Step 5. No commit / push / merge / production deploy.

## Wired (vs CONTRACT)

| Area | Status | Notes |
|------|--------|-------|
| Wallet snapshot | **WIRED** | `GET /api/v1/game/wallet` + balance adds `availableMinor`/`frozenMinor`; lobby/hub/slot refresh via same identity+ledger path |
| Deposit | **WIRED (test harness)** | Create order → PENDING → test confirm / admin confirm → MoneyService.credit; presets from config |
| Withdrawal | **WIRED** | Debit-on-request hold → admin approve/reject/pay; cancel releases; anti-overdraw |
| VIP 1–6 | **WIRED** (reuse) | Config + hub/lobby VIP center real levels |
| VIP chests | **WIRED** (reuse) | Existing claim → MoneyService |
| Activities / check-in | **WIRED** | Server claim; expired not joinable; idempotent |
| Profile | **WIRED** (reuse) | Nick/avatar/phone; never balance/id |
| Win history | **WIRED** | `GET /api/v1/game/wins` Round RO |
| Announcements | **WIRED** (extend reuse) | Existing publishAt/expiresAt filter |
| Admin deposits/withdrawals/activities | **WIRED** | RBAC + audit reason; M9 synced |
| Live provider callbacks | **PENDING BR-007** | Fail-closed without test identity |

## Not rewritten (preserved)

Reel / Spin / Math / RTP / RNG / Paytable / Round settlement cores / Step1 lobby structure / Step2 hub structure / Step3 slot layout / animal anim / win FX / `#gl` translateZ / no `#hud` shell translateZ.

## Money path

All credits/debits call `MoneyService.credit` / `MoneyService.debit` with unique idempotency keys. No client balance mutation. No raw `UPDATE players` balance.

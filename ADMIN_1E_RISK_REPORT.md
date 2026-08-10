# ADMIN-1E Risk Center Report

**Phase:** Risk Center + Audit Center  
**Baseline HEAD:** `9654d4194d2db801467af34cef1ddc5650fd310f`  
**Date:** 2026-08-09  

## Scope

Formal Admin → Risk Center with discover → evidence → manual disposition → audit trail.  
No auto freeze / ban / debit / ledger mutation. PRODUCTION MONEY remains GATE CLOSED.

## Implementation

| Surface | Path | Notes |
|---------|------|-------|
| Core | `lib/admin/admin-risk.ts` | Sync, overview, list/detail, player view, status, notes |
| Schema | `admin_risk_events` + `admin_risk_notes` (admin bootstrap sidecar) | Fingerprint upsert; append-only notes |
| API | `GET risk/overview\|events\|events/:id\|players/:id` | `risk:view` |
| API | `POST risk/events/:id/status\|notes` | `risk:manage`; reason required on resolve/dismiss |
| UI | `app/admin/modules/risk.tsx` | Overview / Events / Player tabs |
| Legacy | `GET risk/signals` | Kept; sync consumes `getRiskSignals` — no second detector stack |

## Overview metrics (real data)

Today events · Open · HIGH · CRITICAL · Login · Device/IP · Session · Gameplay · Wallet/Ledger · Deposit/Withdraw · Recent events · Security summary.

Empty = `0`. Missing source = `NOT_AVAILABLE`. Query failure = `ERROR`. Capability matrix marks IMPLEMENTED / PARTIAL / NOT_AVAILABLE honestly.

## Capability honesty

| Category | State |
|----------|-------|
| AUTH | PARTIAL / NOT_AVAILABLE (no failed-login store; multi-IP when `player_auth_sessions` exists) |
| SESSION | IMPLEMENTED |
| DEVICE | PARTIAL |
| IP | PARTIAL / NOT_AVAILABLE |
| GAMEPLAY | IMPLEMENTED |
| WALLET / LEDGER | IMPLEMENTED (consumes ADMIN-1D integrity) |
| DEPOSIT / WITHDRAWAL | PARTIAL |
| ADMIN_SECURITY | PARTIAL |

## Money gate

Overview returns `productionMoney: false`, `gate: CLOSED`. Risk never opens real money.

## CSV export

`FUTURE` — no insecure ad-hoc export added.

# REVIEW PATCH — Full Frontend × Backend × Admin Wiring

## Summary

Wired formal player spins/balance to durable D1 MoneyService (Intent + Provider + Ledger), added player announcements API + client consume, admin RBAC UI gating, Round↔Wallet↔Ledger deep links, honest system probes, and error-code i18n. Preserved Clarity V2 / Win Presentation / M9 admin additive surface — no math/RTP/real-money enablement changes.

## Critical fixes

1. **Spin/balance no longer use in-memory TestWalletAdapter on live routes** → `createRouteDbWalletAdapter` / D1 stores
2. **Admin can see same wallet/ledger rows as gameplay** (round_id + idempotency link)
3. **Player announcements** `GET /api/v1/game/announcements` (trilingual, schedule/expiry)
4. **Admin nav RBAC** via `/me` permissions + backend 403 retained
5. **Deep links** Round → Wallet / Ledger; Ledger accepts `initialProps`
6. **Balance refresh** on page visibility resume

## Workspaces touched

- Player/formal: `D:\Asian-Buffalo-R1-M8-Cursor-Clean`
- Admin: `D:\Asian-Buffalo-R1-M9-Cursor-Clean` (money stack synced)

## Explicit non-goals

- No commit / merge / push / prod deploy
- No frozen math mutation
- No REAL money enablement
- No destructive DB migration (uses existing `0004` tables + admin bootstrap)

## Delivery paths

All under `docs/m8-review/wiring/` (+ M9 pointer `docs/m9-admin/wiring/README.md`).

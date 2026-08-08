# Step 4 ONLY — Wallet / Deposit / Withdrawal / VIP / Activity / Rewards — MODULE_IMPACT_ANALYSIS

**Date:** 2026-08-07  
**Branch:** feature/ab-r1-m8-cursor  
**Baseline awareness:** `9654d4194d2db801467af34cef1ddc5650fd310f`  
**Rule:** Development Rules V2.0 — analyze before code; whitelist-only edits. STOP after Step 4 delivery (no Step 5).  
**Reuse:** screenshot-features Profile/VIP/Rewards, MoneyService adapters, admin RO patterns. Do **not** rewrite Steps 1–3 pages or slot presentation.

---

## 1. Goal (this run ONLY)

Wire real **Deposit / Withdrawal / VIP / Wallet / Activity / Rewards** FE↔API↔Service↔DB↔Wallet/Ledger↔Admin:

| In scope | Out of scope (STOP / FAIL) |
|----------|----------------------------|
| Wallet snapshot (available/frozen/recent) + shared refresh path | Reel / Spin / Math / RTP / RNG / Paytable rules |
| Deposit orders + channel config + test confirm harness | Round/Settlement cores rewrite |
| Withdrawal request + risk gate + admin review/pay | Step 1 lobby structure / hero redesign |
| VIP 1–6 config (existing) + hub/lobby real data | Step 2 hub structure / hero redesign |
| VIP chests / check-in / activities → MoneyService credit | Step 3 slot layout / animal anim / win FX |
| Profile real data (existing extend) | Client balance mutation |
| Win history Round/Spin RO | Destructive migrations / DROP |
| Announcements schedule/expiry (extend) | Commit / push / merge / production deploy |
| Admin deposit/withdraw/VIP/activity modules + RBAC/Audit/i18n | African Buffalo screenshot numbers as permanent law |

---

## 2. Baseline (before this package)

| Surface | Status |
|---------|--------|
| Profile / VIP / Rewards claim APIs | Working (screenshot-features) |
| Wallet `GET .../balance` | Working (available only) |
| Deposit / Withdrawal tables + APIs | Missing (contract-only) |
| Activity / check-in | Missing (FE stubs) |
| Win history player RO | Missing (BDK empty shell) |
| Admin deposit/withdraw modules | Missing |
| `#gl` translateZ / `#hud` no shell translateZ | Must preserve |
| MoneyService.credit / debit | Adapter — call only; no core rewrite |

---

## 3. Whitelist (ALLOWED_FILES)

```
docs/m8-review/xi-game-v2/step-4-wallet-vip/**
docs/m8-review/screenshot-features/BUSINESS_RULES_PENDING.md

lib/player-commerce-bootstrap.ts
lib/wallet-commerce-service.ts
lib/deposit-service.ts
lib/withdrawal-service.ts
lib/activity-service.ts
lib/win-history.ts
lib/player-announcements.ts
lib/vip-service.ts
lib/vip-rewards.ts
lib/player-profile.ts
lib/game-route-auth.ts
lib/route-money-services.ts

app/api/v1/game/wallet/balance/route.ts
app/api/v1/game/wallet/route.ts
app/api/v1/game/deposit/**
app/api/v1/game/withdraw/**
app/api/v1/game/activities/**
app/api/v1/game/checkin/**
app/api/v1/game/wins/**
app/api/v1/game/profile/**
app/api/v1/game/vip/**
app/api/v1/game/announcements/**

lib/admin/admin-auth.ts
lib/admin/admin-api.ts
lib/admin/admin-queries.ts
lib/admin/admin-bootstrap.ts
lib/admin/i18n.ts
app/admin/admin-app.tsx
app/admin/modules/deposits.tsx
app/admin/modules/withdrawals.tsx
app/admin/modules/activities.tsx
app/admin/modules/vip.tsx
app/admin/modules/players.tsx
app/admin/modules/wallet.tsx

client/xi-lobby/api.ts
client/xi-lobby/i18n.ts
client/xi-lobby/lobby-app.tsx
client/xi-lobby/bdk-hub.tsx
client/xi-lobby/commerce-panels.tsx
client/xi-lobby/lobby.css
client/m5/ui/overlays.ts
client/m5/i18n.ts
lib/wallet-commerce-bootstrap.ts
lib/deposit-service.ts
lib/withdrawal-service.ts
lib/activity-service.ts
lib/win-history.ts
lib/wallet-commerce-service.ts
app/admin/modules/deposits.tsx
app/admin/modules/withdrawals.tsx
app/admin/modules/activities.tsx

tests/step4-wallet-vip.test.mjs
tests/deposit-withdraw.test.mjs
tests/activity-checkin.test.mjs
tests/vip-rewards.test.mjs
tests/player-profile.test.mjs
tests/r1-m7-admin.test.mjs
```

### 3.1 Absolute-minimal Step1/2/3 touch (justified)

| File | Touch? | Justification |
|------|--------|---------------|
| Lobby/hub modal bodies for deposit/withdraw/activity/checkin/records | **Additive wiring only** | Replace stub copy with live API panels; no hero/layout/nav restructure |
| `lobby.css` | **Additive classes only** | `.xi-wallet-*` / form rows; no Step1/2 layout behavior change |
| `overlays.ts` wallet modal | **Fill real wallet data** | No `#hud` transform; no reel touch |
| Play shell / reel / symbol-life / win-presentation | **NO** | Forbidden |
| `money-service.ts` / spin-orchestrator / reel-timing | **NO** | Call credit/debit only |

### 3.2 Business rules policy

Unclear thresholds/fees/channels → admin-configurable defaults + `BUSINESS_RULES_PENDING.md`.  
Fail closed. Never client-mutate balances. All credits/debits via MoneyService + idempotency.

### 3.3 P0 stacking (non-negotiable)

- Keep `#gl { transform: translateZ(0) }` in `client/m5/styles.css` (**do not edit**).
- **NEVER** set `#hud { transform: translateZ(0) }` on the HUD shell.

---

## 4. Forbidden (must not change)

| Area | Reason |
|------|--------|
| Reel / Spin / Math / RTP / RNG / Paytable rules | Engineering bar |
| Round / Settlement cores | Money risk |
| Step 1 lobby structure / Step 2 hub structure / Step 3 slot layout | Explicit forbid |
| Animal anim / win FX | Presentation pollution → FAIL |
| Destructive DB migrations | Explicit forbid |
| Hardcoded African Buffalo screenshot amounts as law | BR pending |
| Commit / push / merge / deploy | Explicit forbid |

---

## 5. Risk / rollback

| Risk | Mitigation |
|------|------------|
| Double deposit credit | Unique provider_ref / idempotency_key; MoneyService intent idempotency |
| Double withdraw debit | Debit-on-request hold; unique request idempotency; status machine |
| Double reward/check-in | Unique claim keys; ALREADY_CLAIMED → idempotent success |
| Cross-player access | resolveActivePlayer; order.player_id must match |
| Client amount forgery | Server validates amount ∈ presets / config min-max only |
| Presentation blackout | Do not touch `#hud` shell transform / reel files |
| Unclear fee/threshold | Config defaults + BUSINESS_RULES_PENDING; fail closed |

**Rollback:** delete new routes/services/admin modules; revert whitelist FE/admin diffs; leave additive IF NOT EXISTS tables in place.

---

## 6. Pause triggers (mid-run)

Pause only if: frozen wallet/ledger **core rule change** required, destructive migration needed, severe money risk, workspace pollution, or unconfirmable business rules blocking fail-closed design.

---

## 7. Delivery gates

npm test / lint / build / tsc / `git diff --check` (honest about pre-existing failures); API contract; wallet-ledger consistency; RBAC; audit; i18n parity; E2E scenarios 1–25; Steps 1–3 regression must pass.

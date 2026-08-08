# Step 5 ONLY — Productionization Wrap-up / Full-Chain Integration — MODULE_IMPACT_ANALYSIS

**Date:** 2026-08-07  
**Branch:** `feature/ab-r1-m8-cursor`  
**Baseline:** Steps 1–4 + `docs/m8-review/xi-game-v2/step-4-wallet-vip/` + `BUSINESS_RULES_PENDING`  
**Rule:** Development Rules V2.0 — locate → impact list → minimal fix → regress → next.  
**STOP:** No new large features. No commit / push / merge / deploy / release.

---

## 1. Goal (this run ONLY)

Stabilize and document full-chain readiness for 《西游戏》 Steps 1–4 wiring:

| In scope | Out of scope (STOP / FAIL) |
|----------|----------------------------|
| BR-005..007 status honesty + Fail Closed / `NOT_PRODUCTION_READY` UI when unset | Invent Zhao production fees/presets/provider secrets |
| Payment channel readiness matrix (KBZ/Wave/TRC20) | Live PSP integration / new payment product |
| Deposit/Withdraw closed-loop verification (test harness) | Wallet/Ledger/Math/RTP core rewrite |
| VIP/activity/check-in/announcements/profile final verify | New VIP tiers / new activity product |
| Click-every-entry dead-button fixes (minimal) | Lobby/hub/play structural redesign |
| Admin modules real API (RO money/math stay RO) | New admin product modules |
| RBAC 403 + Audit (no secrets in logs) | Role redesign |
| Game regression smoke + headed browser evidence | New reel / win FX / animal features |
| Device / perf honest NOT TESTED when no device | Fake PASS |
| i18n zh/my/en parity + error code map | New locale |
| Delivery docs under `step-5-finalize/` | Commit / push / merge / deploy |

---

## 2. Baseline (before this package)

| Surface | Status |
|---------|--------|
| Steps 1–3 lobby/hub/play | Accepted wiring; presentation frozen |
| Step 4 wallet/deposit/withdraw/VIP/activity | Wired FE↔API↔Service↔MoneyService; BR pending |
| Live KBZ/Wave/TRC20 credentials | **Unset** — confirm fail-closed without `AB_ALLOW_TEST_IDENTITY` |
| Deposit presets / withdraw fees | Admin-configurable **placeholders** (not Zhao law) |
| `#gl` translateZ / no `#hud` shell translateZ | Must preserve (do not edit styles stacking) |
| M9 admin workspace | Exists for RO sync checks |

---

## 3. Whitelist (ALLOWED_FILES)

```
docs/m8-review/xi-game-v2/step-5-finalize/**

lib/deposit-service.ts
lib/withdrawal-service.ts
lib/wallet-commerce-bootstrap.ts
lib/wallet-commerce-service.ts
lib/payment-readiness.ts          # NEW small helper (optional)

app/api/v1/game/deposit/channels/route.ts
app/api/v1/game/deposit/route.ts
app/api/v1/game/deposit/confirm/route.ts
app/api/v1/game/withdraw/route.ts
app/api/v1/game/withdraw/[id]/cancel/route.ts

client/xi-lobby/api.ts
client/xi-lobby/i18n.ts
client/xi-lobby/commerce-panels.tsx
client/xi-lobby/lobby-app.tsx      # dead-button / brand only if required
client/xi-lobby/bdk-hub.tsx        # dead-button only if required
client/xi-lobby/play-shell.tsx     # dead-button only if required
client/xi-lobby/lobby.css          # additive readiness banner class only

lib/admin/admin-api.ts             # RBAC/audit verify + minimal harden
lib/admin/admin-auth.ts
lib/admin/admin-queries.ts
lib/admin/i18n.ts
app/admin/admin-app.tsx
app/admin/modules/deposits.tsx
app/admin/modules/withdrawals.tsx
app/admin/modules/activities.tsx
app/admin/modules/vip.tsx

tests/step5-finalize.test.mjs
tests/deposit-withdraw.test.mjs    # additive cases only
tests/step4-wallet-vip.test.mjs    # additive cases only
tests/activity-checkin.test.mjs
tests/vip-rewards.test.mjs
tests/r1-m7-admin.test.mjs
```

### 3.1 Absolute-minimal justified touches

| File | Touch? | Justification |
|------|--------|---------------|
| Deposit/withdraw channel APIs | **Yes** | Expose readiness / `NOT_PRODUCTION_READY` |
| commerce-panels + i18n | **Yes** | Fail-closed banner; TEMP harness label |
| lobby/hub/play | **Only if dead button** | Minimal onClick → real panel/modal |
| Admin modules | **Only if static fake found** | Wire to existing admin API |
| `client/m5/styles.css` `#gl`/`#hud` | **NO** | P0 stacking freeze |
| money-service / spin-orchestrator / math | **NO** | Call only |
| Step 1–3 structure / hero | **NO** | Explicit forbid |

### 3.2 Business rules policy

- Never guess Zhao production numbers for BR-005..007.
- Placeholders remain admin-replaceable.
- Live confirm stays fail-closed without provider secrets / test identity.
- UI must show `NOT_PRODUCTION_READY` when production credentials/thresholds not signed off.

### 3.3 P0 stacking (non-negotiable)

- Keep `#gl { transform: translateZ(0) }` (**do not remove**).
- **NEVER** set `#hud { transform: translateZ(0) }` on the HUD shell.

---

## 4. Forbidden

| Area | Reason |
|------|--------|
| New large product features | Explicit Step 5 scope |
| Reel / Spin / Math / RTP / RNG rewrite | Engineering bar |
| Wallet/Ledger core rewrite | Money risk |
| Step 1–3 structural redesign | Explicit forbid |
| Hardcode African Buffalo / Zhao screenshot amounts as law | BR pending |
| Drive-by refactor / deps / global CSS | V2.0 |
| Commit / push / merge / deploy / release | Explicit forbid |
| Fake device PASS | Honesty gate |

---

## 5. Risk / rollback

| Risk | Mitigation |
|------|------------|
| UI implies live payment ready | Explicit `NOT_PRODUCTION_READY` banner + API flag |
| Double money on retest | Existing idempotency; regression tests |
| Dead button false PASS | Click matrix in FINAL_FUNCTION_RESPONSE_MATRIX |
| Presentation blackout | Do not touch `#hud` shell transform / reel files |
| Secrets in audit logs | Audit payload scrub; SECURITY_REPORT |

**Rollback:** revert whitelist code diffs; leave docs; leave additive IF NOT EXISTS tables.

---

## 6. Pause triggers

Pause only if: Wallet/Ledger/Math core rule change required, destructive migration needed, severe money risk, or Zhao must supply production channel secrets before fail-closed design can proceed (document as gap — do not invent).

---

## 7. Delivery gates

npm test / lint / build / tsc / `git diff --check` — honest about pre-existing Windows CRLF/tsc debt; Step5-touched paths green.  
Unit/integration/contract/E2E/RBAC/wallet-ledger/i18n/nav/admin/payment/VIP/game regression as available.  
All delivery files under `docs/m8-review/xi-game-v2/step-5-finalize/`.

# MODULE_IMPACT_ANALYSIS — Screenshot Feature Completeness

**Rule:** Asian Buffalo Development Rule V1.1 — HIGHEST LAW  
**Living doc:** update whitelist BEFORE each phase’s first code edit.  
**Baseline:** `9654d4194d2db801467af34cef1ddc5650fd310f`  
**P0 freeze:** Do NOT reintroduce `#hud { transform: translateZ(0) }` over unpromoted `#gl`.

---

## Phase 1 — Stabilize

| Item | Value |
|------|-------|
| Allowed files | *(none — verify only)* |
| Forbidden | All money/math/API/CSS feature churn |
| Rollback | N/A |
| Gate | PASS — see `gates/PHASE1_REGRESSION.md` |

---

## Phase 2 — Profile + Avatar (WHITELIST BEFORE CODE)

### Task
Player Profile center modal: avatar, nickname, playerId, phone, currency display, VIP badge, register/last login, status. Edit nickname, choose avatar (16 original placeholders), bind/update phone via stub API. Balance NEVER client-mutated. Admin surfaces avatarId/profile from sidecar tables.

### ALLOWED_FILES

```
docs/m8-review/screenshot-features/**
lib/player-commerce-bootstrap.ts
lib/player-profile.ts
lib/vip-service.ts
lib/vip-rewards.ts
app/api/v1/game/profile/route.ts
app/api/v1/game/profile/avatar/route.ts
app/api/v1/game/profile/phone/route.ts
app/api/v1/game/vip/route.ts
app/api/v1/game/vip/levels/route.ts
app/api/v1/game/vip/rewards/route.ts
app/api/v1/game/vip/rewards/claim/route.ts
app/game-client.tsx
client/m5/ui/hud.ts
client/m5/ui/overlays.ts
client/m5/styles.css
client/m5/i18n.ts
public/avatars/**
lib/admin/admin-queries.ts
lib/admin/admin-api.ts
lib/admin/admin-auth.ts
lib/admin/admin-bootstrap.ts
lib/admin/i18n.ts
app/admin/modules/players.tsx
app/admin/modules/vip.tsx
app/admin/admin-app.tsx
tests/player-profile.test.mjs
tests/vip-rewards.test.mjs
```

**Phase 2 subset for first code batch:** profile bootstrap + profile API + overlays + admin query join + avatar assets + i18n/styles/hud/game-client. VIP service files may be scaffolded empty/seed-only in same bootstrap (tables only) if needed for FK readiness — VIP claim logic waits Phase 3–4 gate docs.

### Forbidden
- `lib/money-service.ts` core rewrite (call `.credit` only from vip-rewards in Phase 4)
- `lib/spin-orchestrator.ts`, math, RTP, round settlement
- Destructive migrations / DROP / ALTER players core columns
- Global CSS outside `client/m5/styles.css`
- `#hud { transform: translateZ(0) }`
- African Buffalo art/logo scrape
- Client-side balance mutation
- Drive-by format/rename of unrelated APIs

### Expected impact
| Area | Expected |
|------|----------|
| Game GL | Unchanged stacking; overlays = DOM modals only |
| Spin | Block Profile/VIP/Wallet open while `game.busy` |
| Wallet | Read-only display of balance from provider |
| Admin players | Shows nickname/avatarId/vip from sidecar |
| Ledger | No Phase 2 credits |

### Rollback
1. Delete new API routes + `lib/player-*.ts` + overlay module  
2. Revert whitelist diffs in hud/game-client/styles/i18n/admin-queries  
3. Sidecar tables are additive IF NOT EXISTS — leave in place (safe) or ignore  

### Unrelated regression checklist
- [ ] Canvas not black  
- [ ] Reel/symbols/buffalo visible  
- [ ] Spin ~6s  
- [ ] All HUD buttons  
- [ ] Balance/Session OK  
- [ ] MeshBasic animal life  
- [ ] Overlay close does not dispose WebGL  

---

## Phase 3 — VIP 1–6 (extend whitelist)

Additional allowed (still additive):
```
lib/vip-service.ts
app/api/v1/game/vip/route.ts
app/api/v1/game/vip/levels/route.ts
app/admin/modules/vip.tsx
```
Conditions admin-configurable — **never hardcode screenshot amounts** (see BUSINESS_RULES_PENDING BR-001..003).

---

## Phase 4 — VIP Reward chests

Additional:
```
lib/vip-rewards.ts
app/api/v1/game/vip/rewards/route.ts
app/api/v1/game/vip/rewards/claim/route.ts
tests/vip-rewards.test.mjs
```
Credits **only** via `MoneyService.credit` + idempotency. FE anim presentation-only.

---

## Phases 5–11

Contracts first in this folder. Code only after per-phase whitelist update + gate PASS on prior phase. Payment/withdrawal paused on BR-005..007 until rules confirmed.

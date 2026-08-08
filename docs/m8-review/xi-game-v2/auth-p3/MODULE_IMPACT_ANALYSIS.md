# MODULE_IMPACT_ANALYSIS — 《西游戏》P3 Player Account System (Auth)

**Rule:** Asian Buffalo Development Rule V1.1 — HIGHEST LAW  
**Living doc:** MUST exist and be updated BEFORE first Auth code edit.  
**Baseline workspace:** `D:\Asian-Buffalo-R1-M8-Cursor-Clean`  
**Admin sync (if needed):** `D:\Asian-Buffalo-R1-M9-Cursor-Clean`  
**Preserve:** P0 hydration, P1 GameClient keep-alive, P2 lobby polish. Do NOT regress Hub/Play/Reel/Spin.  
**Stacking:** Keep `#gl` translateZ; no `#hud` shell translateZ.

---

## Current state (pre-P3)

| Area | Finding |
|------|---------|
| Player identity | Fail-closed `UnconfiguredIdentityProvider`; DEV only via `AB_ALLOW_TEST_IDENTITY=1` → `DevTestIdentityProvider` |
| Player password / JWT / refresh | **None** |
| Register / login / forgot UI | **None** |
| Bootstrap | `ensureDevTestPlayer` + `ensurePlayerCommerceReady` + `MoneyService` (not inventing ledger rules) |
| Profile/VIP | Sidecar `player_profiles` / `player_vip` |
| Admin players | List/detail exist; `device`/`ip` always `null` |
| OTP providers | Phone bind stub only (BR-004); no SK SMS / SMTP |

---

## Task

Formal player Auth: phone/email register (OTP → password → atomic Player+Profile+Wallet+VIP+Session), login, forgot/reset, change password, logout, refresh token, session management, rate limits, audit, i18n Auth UI, lobby topbar hydrate without forced reload, admin visibility of register/login/IP/device.

---

## ALLOWED_FILES

```
docs/m8-review/xi-game-v2/auth-p3/**

lib/player-auth-bootstrap.ts
lib/player-password.ts
lib/player-otp.ts
lib/otp-providers.ts
lib/player-auth-service.ts
lib/player-session.ts
lib/player-auth-audit.ts
lib/player-auth-api.ts
lib/runtime-identity.ts
lib/game-route-auth.ts
lib/identity.ts
lib/player-profile.ts
lib/player-commerce-bootstrap.ts
lib/dev-test-bootstrap.ts
worker/index.ts

app/api/v1/auth/[...slug]/route.ts
app/xi/login/page.tsx
app/xi/register/page.tsx
app/xi/forgot/page.tsx

client/xi-lobby/auth-app.tsx
client/xi-lobby/auth-api.ts
client/xi-lobby/api.ts
client/xi-lobby/lobby-app.tsx
client/xi-lobby/i18n.ts
client/xi-lobby/lobby.css
client/xi-lobby/nav.ts

lib/admin/admin-queries.ts
app/admin/modules/players.tsx
lib/admin/i18n.ts

tests/player-auth-p3.test.mjs
tests/xi-auth-i18n.test.mjs
```

**M9 sync (admin query only, if drift):**

```
D:\Asian-Buffalo-R1-M9-Cursor-Clean\lib\admin\admin-queries.ts
```

---

## Forbidden

- `lib/money-service.ts` core rewrite / ledger posting rules / RTP / RNG / spin orchestrator
- Deposit / Withdrawal / VIP business rule changes
- Destructive Drizzle migrations / DROP / ALTER core `players` columns
- Fake balances / demo online counts
- Drive-by Hub/Play/Reel redesign; `#hud { transform: translateZ(0) }`
- Hardcoded production SK SMS / SMTP secrets
- Commit / push / merge / deploy

---

## Expected impact

| Area | Expected |
|------|----------|
| Identity | Session cookie preferred; else DevTest if gated; else fail-closed |
| Wallet | Register creates player; ledger accounts at **0** via existing ensure path — **no** `seed(100_000)` for auth-created players |
| Test identity | Preserved for local harness; OTP test codes only when `AB_AUTH_OTP_TEST_MODE=1` |
| Lobby | Auth routes + topbar login/avatar refresh without full reload |
| Hub/Play/Spin | Untouched |
| Admin | IP/device/register/login from auth session sidecar |
| Money/Ledger cores | Call only existing bootstrap / `getAvailableBalance` ensure |

---

## Env flags (documented)

| Flag | Behavior |
|------|----------|
| `AB_ALLOW_TEST_IDENTITY=1` | Existing DevTest player path (unchanged purpose) |
| `AB_FORCE_FAIL_CLOSED_IDENTITY=1` | Force fail-closed (overrides DevTest) |
| `AB_AUTH_OTP_TEST_MODE=1` | Accept fixed OTP `123456` only; SK SMS / SMTP stubs log-only |
| Without OTP test mode + without live provider config | OTP send **fail-closed** (`PROVIDER_NOT_CONFIGURED`) |

SK SMS / SMTP adapters: **NOT_PRODUCTION_READY** stubs.

---

## Rollback

1. Remove `app/api/v1/auth/**` and Auth UI routes.  
2. Revert identity chain to pre-session `createRuntimeIdentityProvider`.  
3. Auth sidecar tables are additive `IF NOT EXISTS` — safe to leave empty.  
4. No core migration to reverse.

---

## Gate checklist

- [x] MODULE_IMPACT written before code  
- [x] Unit/integration: register/login/reset/hash/idempotent init  
- [x] i18n zh/en/my parity for Auth strings  
- [x] No MoneyService/RTP/Spin regression (spot suites PASS)  
- [x] Delivery pack under `docs/m8-review/xi-game-v2/auth-p3/`  
- [x] NO commit/push/merge/deploy  
- [ ] Mobile screenshots — see `BLOCKED_CAPTURE.md`

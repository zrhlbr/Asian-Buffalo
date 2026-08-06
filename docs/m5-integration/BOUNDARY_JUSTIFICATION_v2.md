# M5 v2 — Boundary / Necessity of Backend Touches

This note is an **attachment** (not part of the code Review Patch).

## Deploy config — moved out

| File | v2 status |
|---|---|
| `.openai/hosting.json` | **Reverted** to baseline `d1: null`. D1 binding change is out of M5 patch scope. |

Local browser play against D1 therefore requires a **separate** hosting decision.

## Files still modified (minimal necessary) and why

### `app/api/v1/game/sessions/route.ts`
**Why:** Approved M5 requirement includes TEST IdentityProvider with production fail-closed. Routes must call `createRuntimeIdentityProvider()` so the explicit `AB_ALLOW_TEST_IDENTITY=1` gate can take effect. Unchanged handlers (`handleCreateSession`) still perform Session + FROZEN math selection. DEV player seed runs only when the gate is open.

### `app/api/v1/game/spins/route.ts`
**Why:** Same identity gate. Shared TEST wallet/round store enables HUD balance continuity across spins without modifying Wallet/Ledger implementations. `allowRealMoney: false` unchanged. Handler body still `handleSpin` (M3 orchestrator untouched).

### `app/api/v1/game/rounds/[roundId]/route.ts`
**Why:** M5 Recovery UI calls GET round. Must use the same identity gate so ownership checks remain server-authoritative.

### `app/api/v1/game/wallet/balance/route.ts` (**new**, M5-only)
**Why:** Formal Session response has no balance field. HUD needs a read path. Implemented as a new route; does **not** modify `lib/api-handlers.ts`.

### `worker/index.ts`
**Why:** Miniflare/Worker bindings from `.dev.vars` land on `env`, not always `process.env`. A minimal bridge copies **only if present** — never invents `AB_ALLOW_TEST_IDENTITY=1`. Without this, explicit opt-in via `.dev.vars` would be invisible to the gate.

### `lib/api-handlers.ts`
**v2 status:** **Reverted** to baseline. No M5 exports added.

### `vite.config.ts`
**v2 status:** **Reverted** to baseline. No default TEST identity vars.

## Explicit identity rule (v2)

- Default: fail-closed in DEV / TEST / Preview / Production
- Open only when `AB_ALLOW_TEST_IDENTITY=1`
- Automated tests set the variable themselves
- `.dev.vars` template does **not** enable the flag

# I18N_FINAL_REPORT — Step 5

## Lobby / hub (`client/xi-lobby/i18n.ts`)

| Locale | Key count | Parity |
|--------|-----------|--------|
| zh-CN | 159 | baseline |
| en | 158 | PASS (delta = locale key `zh-CN` only) |
| my-MM | 158 | PASS |

### Step 5 additive keys (zh/en/my)

- `lobby.commerce.notProductionReady`
- `lobby.commerce.tempHarness`
- `lobby.commerce.placeholderLimits`

## Admin (`lib/admin/i18n.ts`)

| Check | Result |
|-------|--------|
| zh/en/my identical key sets | PASS (`r1-m7-admin.test.mjs`) |

## Slot HUD (`client/m5/i18n.ts`)

| Brand | Result |
|-------|--------|
| `gameTitle` 牛魔王 | PASS |
| User-visible "Asian Buffalo" brand string | none in xi-lobby; CSS comment / math-config comments historical — left intact |
| Symbol key `sym_buffalo` | animal symbol label — keep |

## Error code mapping (player-facing)

| Code | UI handling |
|------|-------------|
| `NOT_PRODUCTION_READY` / readiness.code | Banner copy |
| `PROVIDER_NOT_CONFIGURED` | Mapped to notProductionReady string on deposit confirm |
| `NETWORK` / HTTP errors | `lobby.commerce.error` / message passthrough |
| `AMOUNT_NOT_IN_PRESETS` / `INSUFFICIENT_BALANCE` | Server message shown (no fake success) |

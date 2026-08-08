# ALLOWED_FILES + ACTUAL FILE_LIST — blackscreen P0

## ALLOWED_FILES (declared pre-edit in MODULE_IMPACT_ANALYSIS.md)

```
client/m5/game/reels.ts
client/m5/game/symbol-life.ts
client/m5/game/reel-timing.ts
client/m5/game/symbols.ts
client/m5/scene/world.ts
client/m5/scene/buffalo.ts
client/m5/scene/particles.ts
client/m5/styles.css
client/m5/ui/hud.ts
client/m5/game/game.ts
client/m5/boot.ts
client/m5/quality.ts
client/m5/win-presentation.ts
app/game-client.tsx
docs/m8-review/blocker-blackscreen-p0/*
```

## ACTUAL FILE_LIST (edited for fix)

| File | Why |
|------|-----|
| `client/m5/styles.css` | Root cause: `#hud { transform: translateZ(0) }` over unpromoted `#gl` could composite as opaque ink plane (HUD-only black main). Removed HUD shell transform; promoted `#gl` with `translateZ(0)`; `#loading.done { display:none }`. Kept `#gl` `pointer-events:none` + z-index contract for buttons. |
| `client/m5/scene/world.ts` | Guard `render()` against dispose/context-loss race throwing out of rAF (secondary harden). |
| `docs/m8-review/blocker-blackscreen-p0/*` | Delivery evidence only |

## Not touched (forbidden / unnecessary)

`app/api/*`, wallet/ledger/math/spin/round/db/admin/auth/session cores, `symbol-life.ts` amplitude (Step5 deferred — prior amp not the black cause).

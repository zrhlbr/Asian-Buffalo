# Preload Architecture (Hub→Play)

## Priority 1 (Hub idle + hover/touchstart)

- Play route prefetch (`/xi/bull-demon-king/play`)
- `client/m5/boot.ts` chunk import
- Symbol art URLs + `preloadSymbolArt()` (LOW: core subset filter; MED+: full 13)
- `warmGameClient({ deferBootstrap: true })` — WebGL/shaders, **no** Session/Spin/Round
- Audio `warmupFromGesture()` — single AudioContext, then suspend

## Priority 2/3 (lazy)

- Heavy win FX / coin rain budgets restored on activate (not during warm)
- LOW suspend sets particle budgets to 0; HIGH/ULTRA keep cache

## Never early

- `/api/v1/game/sessions`
- `/api/v1/game/spins`
- Round recovery (runs only in `ensureBootstrap` on ACTIVE)

## Entry overlay

If activate path >150ms → light `.xi-play-loading` (西游戏 + `lobby.play.loading` trilingual).

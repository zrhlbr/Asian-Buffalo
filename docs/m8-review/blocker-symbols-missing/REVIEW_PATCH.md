# REVIEW_PATCH — blocker symbols + 6s timing

## Summary

1. **Blocker:** Reel tiles invisible after fx-animal `ShaderMaterial` swap → restored `MeshBasicMaterial` via `createSymbolMaterial` / `updateSymbolLife`.
2. **Timing:** Confirm normal/auto/FS visual total **6000ms** (staggered stops 4200–5800 + 200ms bounce); turbo independent **2500ms**; direction top→bottom unchanged.

## Diff focus

### `symbol-life.ts`
- `createSymbolMaterial` → `MeshBasicMaterial({ map, transparent, depthWrite:false })`
- `updateSymbolLife` drives `mat.opacity` + tint pulse (wild/scatter/win)
- GLSL `VERT`/`FRAG` retained as `SYMBOL_LIFE_SHADER_SOURCE` for contract / future re-enable

### `reels.ts`
- Cast cells to `SymbolTileMaterial`
- `spinAll` documents shared 6s profile (server may return early)

### `reel-timing.ts` (unchanged values)
```
NORMAL_SPIN_TOTAL_MS = 6000
NORMAL_REEL_STOP_MS  = [4200, 4600, 5000, 5400, 5800]
NORMAL_BOUNCE_MS     = 200
TURBO_SPIN_TOTAL_MS  = 2500
SPIN_SPEED_MULT      = 1.35
```

## Rollback

1. Revert `symbol-life.ts` / `reels.ts` to prior ShaderMaterial wiring (not recommended — reintroduces blocker)
2. Timing: edit `reel-timing.ts` constants only

# ROOT_CAUSE_REPORT — Black main area P0

## One-liner

Clarity/button-era `#hud { transform: translateZ(0) }` above an unpromoted WebGL `#gl` could composite the HUD shell as an opaque plane over `--ink`, leaving only top/bottom HUD while the main viewport reads black.

## Evidence

| Check | Result |
|-------|--------|
| Scene / reels present | Yes — 30 tiles, 20 visible, sceneN≈47, edge fill≈0.88 |
| Canvas size | 1280×720 (not zero) |
| WebGL context lost (idle) | No |
| Loading trap | Was `opacity:0` + still `display:flex; z-index:100` |
| Exact symptom match | Forced `#gl { visibility:hidden }` → HUD + solid black main (`repro-canvas-hidden.png`) |
| Context lose | White void + HUD (`repro-context-lost.png`) — not the reported black |
| Amplitude / ShaderMaterial | Tiles remain MeshBasic; amp profiles not required for black repro |
| Button PE contract | Must keep `#gl { pointer-events:none; z-index:0 }` |

## Why not CSS-only band-aid

Fix restores compositor layering so the canvas paints again (promote `#gl`, remove full-HUD `translateZ`), and hard-dismisses `#loading.done`. Not a fake opaque wallpaper over a dead GL context.

## Fix applied

1. Remove `#hud` shell `transform` / `backface-visibility` (Clarity-era)
2. Add `#gl { transform: translateZ(0) }` own layer
3. Keep PE/z-index button contract
4. `#loading.done { display:none !important }`
5. `World.render()` no-op if disposed; swallow dispose/context race

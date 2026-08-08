# Root cause — missing reel symbols

**One sentence:** Custom `ShaderMaterial` from the fx-animal `symbol-life` path replaced the proven `MeshBasicMaterial` tile renderer and produced no visible tiles under the M8 ACES + EffectComposer + OutputPass stack (three@0.166), leaving only the opaque metal frame.

## Evidence chain

| Step | Finding |
|---|---|
| 1 Symbol data | Idle `setGrid` + server grid OK — not empty |
| 2 Adapter grid | Formal provider returns 5×4 `SymbolId[][]` |
| 3 Factory | `Reel` constructed meshes; after fix `basicOk=30` with maps |
| 4–6 Assets | PNG `?url` + canvas fallback; textures present (`hasMap: true`) |
| 7 Scene graph | Meshes parented under reel groups |
| 8 Mask | Top/bottom vignette only — does not clear mid rows |
| 9–10 Z/alpha | Frame opaque; broken path used custom `uOpacity` without MeshBasic opacity path |
| 11 Painters | Fallbacks intact; commercial PNGs also load |
| 12 Init | No early exit |
| 13–15 Loader/404 | Some network 404 noise; not the visibility root cause (tiles still painted) |

## Fix

Restore tile rendering to `THREE.MeshBasicMaterial` (HEAD-stable path) inside `createSymbolMaterial` / `updateSymbolLife`, keeping the symbol-life API + GLSL contract for future re-enable. Win/idle pulse via tint/opacity.

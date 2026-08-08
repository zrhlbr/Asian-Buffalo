# Animal Life V2 — Review Patch

**Scope:** Presentation-only species-specific symbol idle / accent / win life  
**Baseline constraint:** Do **not** reintroduce reel-tile `ShaderMaterial` (invisible under ACES + EffectComposer + OutputPass on three@0.166).  
**Unchanged:** reel top→bottom, `NORMAL_SPIN_TOTAL_MS=6000`, money/math/API/DB.

## Approach (why visible)

Reel tiles stay on `THREE.MeshBasicMaterial` via `createSymbolMaterial` / `updateSymbolLife`.

Life motion is applied with proven-visible techniques only:

1. **Per-mesh transforms** — breath scale, look offset (X), sway/ear roll (rotZ), accent toss/nod/trunk/head-up (Y/scale)
2. **Per-material color tint** — breath warmth, wild metal flow (RGB), scatter sun energy, win gold pulse
3. **Opacity** — existing fade / visibility path (not custom `uOpacity` alone)
4. **Win accent latch** — `triggerSymbolWinAccent` on highlight (species win intensifier)

No tile `ShaderMaterial`. Shared textures are never UV-mutated (would sync neighbors).

## Files touched

| File | Change |
|---|---|
| `client/m5/game/symbol-life.ts` | Species profiles, desynced accent scheduler, MeshBasic life pose |
| `client/m5/game/reels.ts` | Wire species id / seed / mesh pose; win accent on highlight |
| `tests/r1-m8-symbol-life.test.mjs` | Species / sync / LOD / MeshBasic contracts |

## Safety

- No commit / merge / push performed
- No Formal provider / wallet / ledger / paytable imports in life/reels
- 3D buffalo scene roar/charge/jackpot hooks unchanged (still used by win tiers)

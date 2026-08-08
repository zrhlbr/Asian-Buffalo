# Animal Life V2 — Test Results

**Command:** `node --experimental-strip-types --test tests/r1-m8-symbol-life.test.mjs`  
**Result:** **14/14 PASS** (duration ~158ms)

| Test | Result |
|---|---|
| animal symbol life module covers all formal animal IDs | PASS |
| species profiles differ and lion forbids buffalo-style nod | PASS |
| per-cell phase/seed diverge so accents are not synchronized | PASS |
| LOD reduces intensity but never fully disables buffalo | PASS |
| createSymbolMaterial stays MeshBasicMaterial (visible path) | PASS |
| reels wire species life and keep downward spin direction | PASS |
| symbol-life source forbids reel ShaderMaterial tiles | PASS |
| buffalo exposes idle / roar / victory / bigWin / jackpot contracts | PASS |
| win FX and animal cues stay presentation-only in Game | PASS |
| quality tiers expose symbolAnimIntensity without lowering DPR clarity | PASS |
| boot wires symbol anim intensity and Formal provider only | PASS |
| audio animal cues are fail-soft | PASS |
| symbol-life and reels do not import formal money cores | PASS |
| reel timing contract still NORMAL_SPIN_TOTAL_MS = 6000 | PASS |

## Contract coverage

- Species fingerprints unique across buffalo/lion/elephant/zebra/antelope/wild/scatter
- Lion `allowNod=false` and accents exclude `nod`
- MeshBasicMaterial instance check + opacity>0 idle path
- No `new THREE.ShaderMaterial` in `symbol-life.ts` or reel tile path in `reels.ts`
- Buffalo LOD floor ≥ 1 even when lod=0

# Animal Life V2 — Species Matrix

Material path for all reel tiles: **MeshBasicMaterial** (transform + tint + opacity).

| Symbol | Continuous idle | Accent pool (3–10s, desynced) | Win intensifier | Forbidden / notes |
|---|---|---|---|---|
| **buffalo** | Breath, nostril warmth on breath peaks, slow look L/R, soft sway, eye micro via look | blink, ear, snort, toss, **nod**, mouth, lookHold | **headUp** (tier≥1.6 → chargeHint on tile); 3D buffalo roar/charge/jackpot via scene | Highest power; LOD never fully disables |
| **lion** | Breath, blink cadence, **mane drift** (sway), look L/R | blink, mane, lookHold, mouth, nose, ear | **growl** (mouth open + warm tint) | **No buffalo-style nod** |
| **elephant** | Breath (slower), ear sway, trunk sway (look X), body sway | blink, ear, lookHold, toss | **trunkRaise** | — |
| **zebra** | Breath, look L/R, light sway | blink, ear, lookHold, toss, **tail** | toss | Tail = rotZ flick if plate shows rear |
| **antelope** | Breath (faster), alert ear sway, look L/R | blink, ear, lookHold, **slight nod OK** | **headUp** | Nod allowed (unlike lion) |
| **wild** | Glow breathe (scale), **metal RGB flow**, gold/blue current | energyPulse, sweep | energyPulse | No animal motion |
| **scatter** | Temple/sun warm tint, gold energy breathe | sweep, energyPulse | sweep | No animal motion |
| **letters** | None (intensity 0) | — | light win tint only | — |

## Sync / LOD rules

- Per-cell `symbolPhase` + `symbolSeed` → accent clocks diverge (not board-synced)
- Winning tiles: shorter accent interval + species `winAccent`
- Non-winning: normal idle
- LOD: intensity 2 full / 1 reduced amp + rarer accents / buffalo floor = max(1, lod)

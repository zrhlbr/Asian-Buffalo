# Animal Life V2 — Capture Status

**No fake media shipped.**

| Asset | Status | Reason |
|---|---|---|
| Idle board video (all animals alive) | **BLOCKED** | No headed Chromium / device capture this pass |
| Per-species accent clips (buffalo nod, lion no-nod, elephant trunk, etc.) | **BLOCKED** | Same |
| Win intensifier clips | **BLOCKED** | Same |
| Phone landscape life | **BLOCKED** | No headed phone this pass |
| Jackpot buffalo charge (scene) | **BLOCKED** | Existing scene hook; not re-captured |

## What was verified instead

- Unit contracts in `tests/r1-m8-symbol-life.test.mjs` (14/14)
- Visibility path: MeshBasicMaterial + opacity/tint/transform (blocker restore preserved)
- Source audit: no reel-tile ShaderMaterial construction

## Re-run when headed

1. Boot Formal client, quality high, idle ≥20s — confirm all symbols visible and desynced micro-motion
2. Force grids with each animal / wild / scatter — confirm species-specific accents
3. Win a lion line — confirm growl intensifier, **no nod**
4. Win buffalo / jackpot — tile headUp + scene roar/charge
5. Quality low — buffalo still breathes; accents rarer

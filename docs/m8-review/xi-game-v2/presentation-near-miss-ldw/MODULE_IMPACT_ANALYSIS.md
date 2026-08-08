# Presentation Near-Miss + LDW — MODULE_IMPACT_ANALYSIS

**Date:** 2026-08-08  
**Branch:** feature/ab-r1-m8-cursor (working tree)  
**Option:** **1 ONLY** — Presentation Near-Miss + LDW from **real server spin results**  
**Rule:** Development Rules V2.0 + **Math freeze** — analyze **before** code; ONE MODULE (client presentation). STOP after delivery.  
**NO** commit / push / merge / deploy / DB migration.

---

## 1. Goal (this run ONLY)

Add **client-only** presentation behaviors driven by existing server spin fields (`winMinor` / `totalBetMinor` / `lineWins` / `grid` / `roundId` / status-equivalent miss):

| Behavior | Trigger (server truth) | Presentation | Money path |
|----------|------------------------|--------------|------------|
| **LDW (pseudoWin)** | `0 < winMinor < totalBetMinor` (multiplier ∈ (0,1)) | Light celebratory FX + upbeat small-tier SFX | HUD Win meter shows **real** `winMinor` — never inflate |
| **Near-Miss** | True miss: `winMinor === 0` and no paying `lineWins` | ~35% of misses show edge-illusion stop accent near high-value / scatter-like cells | No payout; do **not** invent winning grid |
| Real Big+ | Existing multiplier ladder (≥10× … Jackpot) | Unchanged Big/Mega/Ultra/Super/Epic/Jackpot ladder | Unchanged |

Determinism: Near-Miss roll uses **hash(roundId)** (no `Math.random` on first paint / hydration). Quality **LOW** reduces FX intensity. Spin timing contract (~6s) untouched.

---

## 2. Hard bans (LOCKED)

| Ban | Status |
|-----|--------|
| RNG / RTP / Math / Paytable | **LOCKED** |
| Spin server logic / Round / Settlement amounts | **LOCKED** |
| Wallet / Ledger / balance mutation beyond server `balanceAfterMinor` display | **LOCKED** |
| New `calculate_spin_result` / client win decision | **FORBIDDEN** |
| `luck_factor` | **FORBIDDEN** |
| Invent winning grid / alter symbols for “almost won” | **FORBIDDEN** |
| Commit / push / merge / deploy | **FORBIDDEN** |

Allowed: map presentation from existing spin/result fields; win-presentation / reels stop FX / audio / overlays / i18n; tests asserting presentation-only.

---

## 3. Mapping rules (presentation-only)

### 3.1 Inputs (existing `PresentationSpinResult`)

- `roundId` — seed for near-miss determinism  
- `winMinor` — server payout (HUD truth)  
- `totalBetMinor` — server bet (LDW compare)  
- `lineWins[]` — empty ⇒ no paylines for near-miss eligibility  
- `grid` — **display only** for which cells to accent (never rewritten)  
- `scatterCount` / specials — optional accent preference (still miss if `winMinor === 0`)

### 3.2 LDW / pseudoWin

```
isPseudoWin = winMinor > 0 && totalBetMinor > 0 && winMinor < totalBetMinor
```

- Presentation flag: `pseudoWin: true`  
- Choreography: additive **small celebratory** tier (≤ normal intensity; not Big+)  
- Audio: dedicated upbeat small cue (or `winNormal`-class)  
- Meters: `hud.showWin(winMinor)` **exactly** — no rounding up, no fake multiplier text claiming “Big Win”

### 3.3 Near-Miss

```
isTrueMiss = winMinor <= 0 && lineWins.length === 0
nearMissRoll = hashU32(roundId) % 100 < 35   // ~35%, deterministic
showNearMiss = isTrueMiss && nearMissRoll
```

- Prefer accent cells already on grid that are high-value (buffalo/lion/elephant/wild) or scatter-like, especially near reel edge / last-stop illusion — **highlight cues only**  
- Do **not** claim “you won” in toast; prefer pure FX (optional careful copy: “so close” style — never “won”)  
- LOW quality: scale glow / particle / shake down; never block spin or extend ~6s contract

### 3.4 Interaction with existing ladder

`resolvePresentationTier` remains for real wins. LDW may still resolve to `normal` (or soft normal) by existing rules when `winMinor > 0`; Big+ thresholds unchanged. Near-Miss only applies when tier would be `none` and miss is true.

---

## 4. Whitelist (ALLOWED_FILES)

| File | Change |
|------|--------|
| `client/m5/win-presentation.ts` | LDW + Near-Miss resolvers, hash seed, intensity scale, additive choreo |
| `client/m5/game/game.ts` | Wire presentation flags after server result; FX only |
| `client/m5/game/reels.ts` | Optional near-miss stop-accent / soft highlight API (no timing change) |
| `client/m5/audio.ts` | `pseudoWin` / `nearMiss` cues + `playCue` cases |
| `client/m5/i18n.ts` | Optional trilingual near-miss string (careful wording) if used |
| `client/m5/quality.ts` | Export helper to read current tier intensity for FX scale (if needed) |
| `tests/r1-m8-presentation-near-miss-ldw.test.mjs` | **NEW** — mapping + freeze guards |
| `docs/m8-review/xi-game-v2/presentation-near-miss-ldw/**` | Delivery package |

### Forbidden paths (do not touch)

`lib/spin-orchestrator.ts`, `lib/server-game-engine.ts`, `lib/round-service.ts`, `lib/wallet-adapter.ts`, `lib/db-ledger.ts`, `lib/money-service.ts`, math/paytable modules, migrations, admin business APIs.

---

## 5. Module impact

| Module | Impact |
|--------|--------|
| Win presentation | Additive LDW + Near-Miss flags / cues |
| Reels | Visual accent only; stop schedule from `reel-timing.ts` unchanged |
| Audio | New presentation cues |
| HUD meters | Still server amounts only |
| Quality LOD | Intensity multiplier; LOW softens FX |
| Spin / Wallet / Ledger / Math | **None** |

---

## 6. Risks & rollback

| Risk | Mitigation |
|------|------------|
| Players confuse Near-Miss with a win | Pure FX; no “you won” copy when payout=0 |
| LDW feels like inflated win | HUD shows real `winMinor`; no Big+ overlay for LDW |
| Hydration flicker from `Math.random` | Hash(`roundId`) only |
| Timing drift | No changes to `NORMAL_SPIN_TOTAL_MS` / stop Ms |

Rollback: revert whitelist files; money path never changed.

---

## 7. Acceptance (this option)

1. LDW fires only when server pays less than bet; meter truth matches `winMinor`.  
2. Near-Miss only on true miss; ~35% via deterministic seed; grid unchanged.  
3. Big/Mega/… ladder for large real wins unchanged.  
4. Gates: presentation tests PASS; money/math modules show no presentation imports.  
5. No commit / push / merge / deploy.

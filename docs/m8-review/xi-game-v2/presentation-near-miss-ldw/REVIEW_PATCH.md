# Presentation Near-Miss + LDW — REVIEW_PATCH

**Date:** 2026-08-08  
**Option:** 1 ONLY — Presentation Near-Miss + LDW from real server spin results  
**Scope:** Client presentation mapping only  
**Settlement / Wallet / Ledger / RNG / RTP / Math:** **UNTOUCHED**

---

## Mapping rules (canonical)

### Inputs (existing `PresentationSpinResult`)

| Field | Use |
|-------|-----|
| `winMinor` | Payout truth → HUD Win meter; LDW compare |
| `totalBetMinor` | LDW when `0 < winMinor < totalBetMinor` |
| `lineWins` | Empty + `winMinor <= 0` ⇒ true miss |
| `grid` | Accent cells for near-miss (never rewritten) |
| `roundId` | FNV-1a seed for ~35% near-miss roll |

### LDW (`pseudoWin`)

```
isPseudoWin = winMinor > 0 && totalBetMinor > 0 && winMinor < totalBetMinor
```

- Plays `PSEUDO_WIN_CHOREO` (light celebratory FX + `pseudoWin` SFX)
- `hud.showWin(result.winMinor)` — **never inflate**
- No Big/Mega/… overlay for LDW
- Quality scale via `data-xi-tier` → `presentationFxScale`

### Near-Miss

```
isTrueMiss = winMinor <= 0 && lineWins.length === 0
showNearMiss = isTrueMiss && (hashRoundSeed(roundId) % 100 < 35)
```

- `pulseNearMissAccent` on existing high-value / scatter-like cells (prefer rightmost reels)
- `NEAR_MISS_CHOREO` — frame glow + soft sparks; **no coin rain**, no win meter
- i18n `closeCall` exists (zh/en/my) but **not toasted** by default (prefer pure FX)
- LOW quality reduces intensity; spin timeline (~6s) unchanged

### Real Big+ ladder

Unchanged: Big ≥10× … Jackpot ≥100× via existing `resolvePresentationTier` / `WIN_TIERS`.

---

## Code delta (this option)

1. **`win-presentation.ts`** — `hashRoundSeed`, `isPseudoWin`, `isTrueMiss`, `shouldShowNearMiss`, `pickNearMissAccents`, `resolvePresentationOutcome`, `PSEUDO_WIN_CHOREO`, `NEAR_MISS_CHOREO`, `scaleChoreographyFx`, `presentationFxScale`
2. **`game.ts`** — post-spin branch: pseudoWin → nearMiss → existing tier ladder
3. **`reels.ts`** — `pulseNearMissAccent` (visual only)
4. **`audio.ts`** — `pseudoWin()` / `nearMiss()` + playCue
5. **`i18n.ts`** — `closeCall` trilingual
6. **Tests** — `tests/r1-m8-presentation-near-miss-ldw.test.mjs`

Full unified diff of dirty working-tree files may include prior unrelated edits; treat this document + SHA256 of whitelist files as the Option 1 review surface. Optional machine diff: `REVIEW_PATCH.diff` (partial; untracked files not in `git diff`).

---

## Explicit non-changes

- No new `calculate_spin_result`
- No `luck_factor`
- No client-authored winning grid
- No Round / Settlement amount changes
- No Wallet / Ledger writes
- No reel timing constant changes
- No commit / push / merge / deploy

# Presentation Near-Miss + LDW — REGRESSION_REPORT

## Spin remains server-authoritative

| Check | Result |
|-------|--------|
| Outcomes from `GameProvider.spin` / formal API only | PASS — `game.ts` awaits `this.provider.spin(...)` then presents |
| Grid authority | PASS — `spinAll(result.grid)`; near-miss accents read cells, never rewrite |
| HUD Win meter | PASS — `hud.showWin(result.winMinor)` for all pays including LDW |
| Balance display | PASS — `hud.setBalance(result.balanceAfterMinor)` from server |
| Settlement / Ledger / Wallet modules | PASS — no presentation imports (static guard in tests) |
| `luck_factor` / local win calc | PASS — absent |
| Reel timing ~6s | PASS — `NORMAL_SPIN_TOTAL_MS === 6000`; stop Ms unchanged |
| Big/Mega/Ultra/Super/Epic/Jackpot ladder | PASS — still driven by multiplier bands for real large wins |
| Near-miss on paid spins | PASS — gated by `isTrueMiss` |
| LDW on full-bet-or-more pays | PASS — `isPseudoWin` false when `winMinor >= totalBetMinor` |

## Behavioral regression notes

1. **Miss without near-miss** — short settle sleep (unchanged path).  
2. **Miss with near-miss (~35% hashed)** — brief accent FX; Win meter stays 0.  
3. **LDW** — light celebration; meter shows true small payout.  
4. **Real Big+** — existing overlay path; not routed through `presentPseudoWin`.  
5. **LOW quality** — reduced spark/glow/shake; does not block spin.

## Residual risk

Players may emotionally read near-miss as “almost won.” Mitigated by: no win toast, no coin rain, no inventing symbols. Optional `closeCall` copy is careful and unused by default.

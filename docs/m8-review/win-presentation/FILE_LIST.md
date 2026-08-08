# M8 Win Presentation — File List

## Added

| Path | Role |
|------|------|
| `client/m5/win-presentation.ts` | Tier resolver + data-driven choreography |
| `tests/r1-m8-win-presentation.test.mjs` | Tier order / FS enter / timing / grid contracts |
| `docs/m8-review/win-presentation/*` | Delivery package |

## Modified (presentation only)

| Path | Change |
|------|--------|
| `client/m5/adapter.ts` | Super/Epic multiplier bands on `WIN_TIERS` / `winTier` |
| `client/m5/audio.ts` | Distinct per-tier procedural SFX + `playCue` |
| `client/m5/game/game.ts` | Choreography orchestrator; free-spin enter |
| `client/m5/game/reels.ts` | Frame glow + win amp (no edge/timing/direction change) |
| `client/m5/game/symbol-life.ts` | Win bounce / intensity 0–2 |
| `client/m5/scene/buffalo.ts` | New win actions (charge, slowWalk, breakReel, …) |
| `client/m5/scene/world.ts` | Celebration mood (wash/darken/lightning/wind/slow-mo) |
| `client/m5/scene/particles.ts` | Pillar style + coin rain rate |
| `client/m5/ui/hud.ts` | Super/Epic celebrate + meter flash |
| `client/m5/i18n.ts` | Super/Epic strings (zh/en/my) |
| `client/m5/styles.css` | Super/Epic/Jackpot HUD chrome |
| `tests/r1-m8-symbol-life.test.mjs` | Accept breakReel jackpot path |
| `tests/r1-m8-clarity-v2.test.mjs` | Bloom contract reads choreography (Clarity V2 intent kept) |

## Untouched (hard ban)

Wallet, Ledger, RTP, Math, Spin server, Round, Grid authority, formal API, Database, Admin, reel edge layout, ~10s spin timing, reel direction.
Clarity V2 work under `client/m5` / `docs/m8-review/clarity-v2` was preserved.

# Presentation Near-Miss + LDW — FILE_LIST

**Option 1 ONLY** — client presentation from real server spin results.  
**Money / Math / Spin server / Settlement:** untouched.

## Added

| Path | Role |
|------|------|
| `client/m5/win-presentation.ts` | LDW + Near-Miss resolvers, hash seed, choreography (also hosts existing win ladder) |
| `tests/r1-m8-presentation-near-miss-ldw.test.mjs` | Presentation-only mapping + freeze guards |
| `docs/m8-review/xi-game-v2/presentation-near-miss-ldw/**` | Delivery package |

## Modified (presentation only)

| Path | Change |
|------|--------|
| `client/m5/game/game.ts` | Wire `resolvePresentationOutcome`; `presentPseudoWin` / `presentNearMiss`; HUD still `showWin(result.winMinor)` |
| `client/m5/game/reels.ts` | `pulseNearMissAccent` — stop-edge visual cue; no timing change |
| `client/m5/audio.ts` | `pseudoWin` / `nearMiss` cues + `playCue` cases |
| `client/m5/i18n.ts` | Trilingual `closeCall` (FX preferred; not toasted by default) |
| `tests/r1-m8-win-presentation.test.mjs` | Accept `resolvePresentationOutcome` wiring |

## Untouched (hard ban)

| Area | Paths (examples) |
|------|------------------|
| Spin / Round / Settlement | `lib/spin-orchestrator.ts`, `lib/round-service.ts`, `lib/server-game-engine.ts` |
| Wallet / Ledger | `lib/wallet-adapter.ts`, `lib/db-ledger.ts`, `lib/money-service.ts` |
| Math / Paytable / RTP | math engine modules |
| Reel timing contract | `client/m5/game/reel-timing.ts` constants unchanged (`NORMAL_SPIN_TOTAL_MS = 6000`) |
| DB / Admin / Deploy | migrations, admin business, production |

## Commit / Push / Merge / Deploy

**NOT performed** (per Dev Rules + task ban).

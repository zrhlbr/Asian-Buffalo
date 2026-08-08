# REGRESSION_REPORT — Performance Quality

**Date:** 2026-08-07  
**Unit tests:** `tests/xi-performance-quality.test.mjs` + clarity/m6 alignment — **31/31 PASS**

## Gates

| Gate | Result |
|------|--------|
| Steps 1–3 routes intact (`/xi`, hub, play) | PASS (additive hooks only) |
| No Math/RTP/Wallet/Ledger/Round edits in this pack | PASS (whitelist) |
| `#gl` translateZ(0) preserved | PASS (test + CSS) |
| `#hud` shell translateZ not restored | PASS (test) |
| Symbol plate 1024 / reel ~6s timing | PASS (clarity-v2 tests) |
| Quality settings persist | PASS (normalize + storage API unit) |
| Degrade order / DPR caps | PASS |
| Governor hysteresis (no bounce-up) | PASS |
| Trilingual quality strings | PASS |
| Headed screenshots by tier | **BLOCKED** — see `BLOCKED_CAPTURE.md` |
| Real mid-phone FPS | **SIMULATED ONLY** |

## Touched presentation modules

- `client/m5/quality.ts` (extended, not rewritten API surface)
- `client/m5/boot.ts`, `world.ts`, `buffalo.ts`, `audio.ts`, `hud.ts`, `i18n.ts`, `styles.css`
- `app/game-client.tsx` settings markup
- `client/xi-lobby/quality.ts`, `quality-panel.tsx`, lobby/hub wiring, CSS
- Hero variants under `public/xi/heroes/`
- Tests listed above

## Risk residual

- Manual ULTRA on weak phones can still oversubscribe GPU (user override)
- AVIF not yet preferred in `<picture>` (WebP wired; AVIF on disk)
- Dispose/remount blackscreen: code-safe, not headed-verified

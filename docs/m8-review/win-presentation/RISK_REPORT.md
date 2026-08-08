# M8 Win Presentation — Risk Report

| Risk | Severity | Mitigation |
|------|----------|------------|
| Accidental money/math coupling | High | Resolver lives only in `client/m5`; tests ban imports in wallet/ledger/spin/math modules |
| Super/Epic threshold confusion with payout | Medium | Documented UI_ONLY; `WIN_TIERS_UI_ONLY = true`; no server change |
| Long fullscreen buffalo hold (~10s) slows autoplay | Medium | Turbo shortens hold; tap-skip remains on overlay tiers |
| Particle spikes on low phones | Medium | Existing budgets + rain rate clamp; degrade particles first |
| Collision with Clarity V2 edits | Medium | Additive-only; no reel edge / DPR / timing rewrites |
| Procedural SFX vs commercial bar | Medium | Documented in `ASSET_GAP.md`; distinct cues per tier |
| Jackpot `breakReel` scale reading as board cross | Low | Buffalo stays left of reel home X; no grid mutation |

## Hard ban compliance

No edits to Wallet, Ledger, RTP, Math, Spin server, Round, Grid settlement, formal API, DB, Admin. No reel edge layout change. No ~10s spin timing change. No reel direction change. No git commit / merge / push / PR.

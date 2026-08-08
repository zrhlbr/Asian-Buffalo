# RISK — Mythic Visual Unification

| Risk | Severity | Mitigation |
|------|----------|------------|
| Opaque HUD overlay blacks out `#gl` | Critical | Edge-only chrome with transparent center; masks; `pointer-events: none`; **no** `#hud { transform: translateZ(0) }` |
| Accidentally changing spin timing | High | Whitelist excludes `reel-timing.ts` / reels stop path; win-presentation durations not altered |
| Fake wallet / math changes | High | No API/DB/math files in whitelist |
| Hub audio spam / Autoplay policy | Low | Sparse interval; gesture unlock via button; silent catch |
| Google Fonts CDN offline | Low | Fallbacks to Noto / Georgia / system |
| Cheap “web-guofeng” look | Medium | Multi-layer depth (rays, cloud sea, silhouettes) + ASSET_GAP for real hero art |
| Scope creep into admin | Low | Player-only; admin untouched this round |

## Money / math confirmation

**Confirmed untouched:** Session, Spin, Round, Wallet, Ledger, RTP, paytable values, symbol IDs, API contracts, DB schemas, admin core.

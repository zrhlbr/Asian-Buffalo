# LOBBY_PERFORMANCE_REPORT — Lobby P2

**Evidence class:** CODE (no headed FPS capture this run)

## Strategy

1. Shell first — light `app/xi/loading.tsx` bar (never solid black)
2. Progressive hero — low WebP first, upgrade to AVIF/WebP srcset 720/1080/1440
3. Particles/FX tiered by quality after hydrate only
4. Session cache for avatar/profile + balance (TTL 60s) — post-hydrate only
5. Lazy-load non-first recommended card images (`loading="lazy"`)

## Quality cuts

| Tier | Particles | Hero rays/clouds | backdrop-filter (lobby chrome) |
|------|-----------|------------------|--------------------------------|
| LOW | 0 | static, no blur filter | forced off |
| MED | 3 | reduced / no animation | forced off |
| HIGH/ULTRA | profile intensity | full (if FX on) | allowed |

## Transform / opacity policy

- Lobby animations use CSS transform/opacity
- `#gl` keeps its own `translateZ(0)`
- No `#hud` shell `translateZ` introduced

## Prefetch

Existing `prefetchXiNavAssets()` retained (journey + BDK heroes) — not modified in warm-nav lifecycle modules.

## Headed FPS

**BLOCKED** — browser automation MCP unavailable in this subagent environment. Mark commercial FPS claims as not evidenced this package.

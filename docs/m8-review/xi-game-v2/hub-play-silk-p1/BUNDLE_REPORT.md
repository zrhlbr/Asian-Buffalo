# Bundle Report (P1 scope)

## Added client modules (Hub↔Play silk)

| Module | Role |
|--------|------|
| `client/xi-lobby/game-lifecycle.ts` | State machine + perf + overlay |
| `client/xi-lobby/game-host.tsx` | Persistent GameClient host |
| `client/xi-lobby/layer-keepalive.tsx` | Hub/Play chrome keep-alive |

## Chunk strategy

- Hub idle: dynamic `import("../m5/boot.ts")` + symbol module (no Session)  
- Play route prefetch via `<link rel=prefetch>` + Next `router.prefetch`  
- GameClient no longer in play-shell static import graph (host-owned)

## Note

Full production bundle sizes not re-measured in this run (no `vinext build` gate required for silk-only delivery). Boot chunk still lazy until Hub warm/idle.

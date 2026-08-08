# WebGL Startup Root Cause (Hub↔Play)

## Before (P0 aftermath)

| Path | Cost driver |
|------|-------------|
| Hub→Play ~2.7s | Play page mounted `GameClient` → full `bootM5` (World/Three/RAF/symbols) every enter |
| Play→Hub ~3.8s | Unmount → `destroy()` + `world.dispose()` blocked perceived leave |

Soft Next router fixed Lobby↔Hub black/hydration, but **GameClient still lived under the Play page**, so Hub↔Play paid cold WebGL every loop.

## After (P1)

1. Persistent `XiGameHost` keeps one WebGL context across Hub↔Play  
2. `deferBootstrap` allows warm mount without Session/Spin/Round  
3. Play→Hub = `suspend` (pause RAF/audio, hide host) — dispose only when leaving Xi  
4. Optimistic layer + sync DOM class swap paints UI before RSC pathname settles (~700ms URL lag residual)

## Residual

- First Hub→Play after idle still may include warm boot (~600–700ms) if hover/idle warm incomplete  
- RSC pathname catch-up ~0.5–0.7s behind UI-first paint (documented; UI metric is host ACTIVE/SUSPENDED)

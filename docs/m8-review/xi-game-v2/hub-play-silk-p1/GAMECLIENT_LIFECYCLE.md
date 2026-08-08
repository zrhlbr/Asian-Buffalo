# GameClient Lifecycle (P1)

## State machine

```
UNINITIALIZED → PRELOADING → READY → ACTIVE → SUSPENDED → DISPOSING → DISPOSED
```

| State | Meaning |
|-------|---------|
| UNINITIALIZED | No host mount |
| PRELOADING | Hidden warm boot in flight (`deferBootstrap`) |
| READY | WebGL+RAF paused; no Session yet or session deferred |
| ACTIVE | Play visible; RAF/audio running; `ensureBootstrap()` allowed |
| SUSPENDED | Left Play; context kept; UI navigated without dispose |
| DISPOSING/DISPOSED | Xi layout unmount only |

## Ownership

- `XiGameHost` (under `XiShell`) — singleton mount
- `game-lifecycle.ts` — state + activate/suspend/warm/dispose
- `bootM5({ deferBootstrap })` — WebGL without Session/Spin/Round until activate
- Play page chrome via `XiLayerKeepAlive` — not GameClient owner

## Invariants

- At most one `bootM5` / `#gl` / AudioContext
- Play→Hub: `suspend()` only — never await `destroy()`
- Hub warm: hover/idle → `warmGameClient({ deferBootstrap: true })`
- `opSeq` cancels overlapping activate after suspend

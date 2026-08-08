# BLOCKED_CAPTURE.md

## Screenshots (captured)

| Asset | Role |
|-------|------|
| `before-idle.png` | Pre-fix idle (already playable in this workspace probe) |
| `repro-canvas-hidden.png` | **Exact symptom match** — HUD + black main when `#gl` not composited |
| `repro-context-lost.png` | Context-loss → white void (ruled out as reported black) |
| `after-idle.png` | Post-fix idle — background + reels + symbols + buffalo |
| `after-spin.png` | Post-fix after spin — win line / symbols visible |
| `after-phone-land.png` | Phone landscape post-fix |
| `headed-idle.png` | Headed Chromium idle |
| `v-desktop.png` / `v-phone-land.png` / `v-phone-port.png` | Viewport matrix |

## Reel video

**BLOCKED** — no headed MP4 recorder in this agent environment.
Mitigation: `after-spin.png` + verify.json spin (`busyMid: true`, balance changed, busy cleared) + reel-timing unit tests PASS (NORMAL_SPIN_TOTAL_MS = 6000).

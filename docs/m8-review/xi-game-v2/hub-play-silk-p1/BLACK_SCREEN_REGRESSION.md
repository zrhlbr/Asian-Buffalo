# Black Screen Regression (P0 must stay green)

## Preserved from P0

- Soft leave veil `rgba(8,10,16,0.28)` — not solid `#0a080c`
- No hard `location.assign` on Hub↔Play
- `#gl { translateZ(0) }` kept; no `#hud` shell `translateZ`
- ui-store hydration-safe (no first-paint device detect)

## P1 additions

- Light `.xi-play-loading` overlay (not solid black) if enter >150ms  
- Optimistic keep-alive — Hub remains painted until Play host ACTIVE  
- Suspend hides host with opacity; does not flash white/black void

## E2E

20-loop black probe fails: **0**

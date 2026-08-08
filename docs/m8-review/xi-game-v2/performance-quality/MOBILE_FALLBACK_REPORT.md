# MOBILE_FALLBACK_REPORT

**Date:** 2026-08-07

## Fallback ladder (runtime)

1. AUTO selects LOW/MEDIUM on weak/mid phones (score + mobile floors)
2. Atmosphere cuts first: particles → shadows → god rays → bloom → bg complexity
3. DPR capped (LOW 1.5 / MED 2) — avoids 3–4× fill-rate tax on weak phones
4. FpsGovernor steps down if FPS &lt; 35 for ~3.8s (no bounce-up)
5. Last resort: `renderScale = 0.92` on LOW only
6. Optional user FPS 30 gate via `FramePacer`
7. Animal **simple**: reduces idle FX frequency; breath/blink/win retained
8. FX off: forces bloom/godrays/particles off across surfaces
9. Lobby/hub CSS: `data-xi-tier` / `data-xi-fx` cuts rays/embers/particles
10. LOW transitions ~200–220ms

## What is never cut first

- Symbol plate resolution (1024 pipeline)
- HUD meter readability
- Reel layout / fill (Steps 1–3 + Clarity contracts)

## Blackscreen / dispose

- `#gl { transform: translateZ(0) }` preserved
- `#hud` shell translateZ **not** restored
- `destroy()` disposes World after canceling rAF; remount boots fresh — designed to avoid return black screen; headed re-entry not captured this session (**SIMULATED / BLOCKED**)

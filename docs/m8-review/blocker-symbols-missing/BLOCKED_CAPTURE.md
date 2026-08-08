# Capture status

## Screenshots (captured)

| File | Status |
|---|---|
| `before-idle.png` / `after-idle.png` | OK — all reel symbols visible |
| `after-spin-settle.png` | OK — symbols after spin (Wild/Buffalo/letters) |
| `probe.json` | OK — MeshBasicMaterial tiles opacity=1 on visible rows |

## Videos

| Clip | Status |
|---|---|
| 6s normal spin | **BLOCKED** — headless Chromium RAF/software WebGL throttles wall-clock; unit contract used instead |
| Turbo ~2.5s | **BLOCKED** — same (headed device needed) |
| Free Spin non-turbo 6s | **BLOCKED** — needs FS state on headed device |
| Phone landscape | **BLOCKED** — no headed phone this pass |

Re-run with headed Chromium / real device when available; constants already locked in `reel-timing.ts`.

# BUTTON_REGRESSION.md

Headless Chromium verify after fix (`verify.json`).

| Control | Result |
|---------|--------|
| Spin | PASS — busyMid true, balance 98210→98200, busy cleared |
| Auto | PASS — toggled false→true |
| Turbo | PASS — toggled false→true |
| Bet +/- | PASS — 50→100 via bet-plus |
| Settings | PASS — modal open/close |
| Language | PASS — zh-CN→en |
| Sound | PASS — class `off` after toggle |
| Back | PASS — `#btn-back` present |
| Paytable | PASS — modal open/close |
| Spin hit-test | PASS — elementFromPoint → `#spin-label` (not canvas) |
| `#gl` PE | PASS — `pointer-events: none`, `z-index: 0` |
| `#hud` PE shell | PASS — `pointer-events: none`, `z-index: 1`, `transform: none` |

**Button gate: PASS**

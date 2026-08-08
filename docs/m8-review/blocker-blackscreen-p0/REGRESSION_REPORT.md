# REGRESSION_REPORT.md

| Module | Status | Notes |
|--------|--------|-------|
| Wallet / balance API | OK | Spin deducted; Formal session alive |
| Session pill | OK | OK online |
| Math / RTP / grid | Untouched | Forbidden |
| Ledger / DB / admin | Untouched | Forbidden |
| Reel timing (~6s) | OK | `r1-m8-reel-timing` 7/7 pass |
| Symbol life MeshBasic | OK | `r1-m8-symbol-life` 14/14 pass |
| Animal amplitude | Unchanged | Prior amp kept; not Step5 re-boost |
| Phone landscape fill | OK | fill≈0.994 |
| Page errors | None | verify errors=[] |

No fix-A-breaks-B incident. If stacking regresses buttons, revert only the `#hud` transform removal / `#gl` translateZ pair in `styles.css`.

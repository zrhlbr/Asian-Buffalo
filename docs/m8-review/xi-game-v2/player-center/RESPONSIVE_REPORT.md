# Player Center Responsive Report

**Target:** Mobile 320–430 (primary); tablet/PC inherit lobby main width.

## Breakpoints (CSS)

| Width | Behavior |
|-------|----------|
| default | Wallet 2-col; shortcuts 4-col; rows ≥44px |
| ≤430px | Shortcuts → 2×2; avatar 56px; tighter type |
| ≤340px | Wallet coins stack 1-col; lang buttons compact |

## Layout notes

- `.xi-pc` uses `min-width: 0` to avoid horizontal overflow in lobby main.  
- Local sheets: `width: min(100%, 420px)`, `max-height: min(82vh, 640px)`, bottom-sheet style on phone.  
- Safe-area: inherits lobby bottom-nav padding; Me content has bottom padding `1.25rem`.  
- `prefers-reduced-motion`: press transforms disabled.

## Headed evidence

SIMULATED / blocked — no local server for viewport capture this session. Code paths cover 320–430 via media queries above. See `BLOCKED_CAPTURE.md`.

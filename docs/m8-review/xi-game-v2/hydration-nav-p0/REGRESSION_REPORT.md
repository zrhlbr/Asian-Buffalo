# REGRESSION_REPORT

## In scope

| Area | Result |
|------|--------|
| Hydration nav unit tests | PASS 9/9 |
| Performance-quality unit tests | PASS 10/10 |
| E2E ×20 loops | PASS (0 hydra / 0 black / 0 dup GameClient) |
| i18n zh/en/my-MM nav | PASS |
| `#gl { translateZ(0) }` | PRESERVED |
| `#hud` shell translateZ | NOT ADDED |

## Forbidden areas (not modified for business logic)

- Math / RTP / RNG / Spin result / Round / Settlement  
- Wallet / Ledger / Deposit / Withdrawal / VIP business rules  
- Admin business modules  

## Touched for lifecycle only

- `client/m5/boot.ts` — additive `pause` / `resume` on handle  
- `app/game-client.tsx` — singleton + event pause/resume  

## Known follow-ups (non-blocking for this P0)

- Hub→Play / Play→Hub wall times still include WebGL boot/dispose (~2–4s) — not a black-gap; optional keep-alive host later  
- Hero prefetch 404s for some generated variants may appear in console if assets missing — does not block nav  
- No commit/push performed (per order)

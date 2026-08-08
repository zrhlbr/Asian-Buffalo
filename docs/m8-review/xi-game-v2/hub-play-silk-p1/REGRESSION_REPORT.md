# Regression Report — Hub↔Play Silk P1

## Untouched (forbidden surfaces)

- RNG / RTP / Math / Paytable / Spin result computation  
- Round / Settlement server logic  
- Wallet / Ledger / Deposit / Withdrawal / VIP **business** APIs  
- Admin modules  
- Lobby visual redesign / Hero / CTA / Logo freeze  

## Preserved behaviors

- Spin busy leave confirm / wait-then-leave (`play-shell.tsx`)  
- P0 hydration-safe ui-store  
- Soft Lobby↔Hub nav  
- Formal `FormalGameProvider` only on ACTIVE bootstrap  

## Static gates

- `tests/xi-hub-play-silk-p1.test.mjs` PASS  
- `tests/xi-hydration-nav-p0.test.mjs` PASS  

## Risk

- Optimistic URL lag: UI ACTIVE before `/play` pathname (~0.5–0.7s) — back/share still OK after settle  
- Keep-alive Hub/Play doubles client mounts of chrome (not GameClient) — monitor low-end memory on device  

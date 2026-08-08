# BLOCKED_CAPTURE — Lobby V3 Boutique Polish

## Status: BLOCKED

Headed device / browser screenshots and videos were **not** captured in this agent run.

### Requested but unavailable here

- PC / tablet / phone 320–375–430 lobby home (hero FX, HOT glow, soon dimmer)
- zh / en / my lang switch (&lt;300ms, no black / hydration flash)
- Coming Soon modal trilingual
- Quick actions hover / red-dot
- Bottom nav safe-area
- Hub / Play smoke after lobby polish
- HIGH vs LOW FX comparison video

### Why blocked

- No local `/xi` dev server listening for inbound capture in this session
- No headed phone attach / Playwright visual project wired for this closure package

### Code-path substitute

See `REGRESSION_REPORT.md` (rows 1–14 PASS). Visual rows 15–16 remain BLOCKED.

### Unblock conditions

1. Start app (`npm run dev` / project local host) and open `/xi`
2. Capture 320 / 375 / 430 + desktop; 3 langs
3. Tap Coming Soon card → modal; tap BDK HOT → hub (do not auto-start Play)
4. Toggle quality LOW/MED/HIGH and note FX matrix
5. Drop PNG/WebM into this folder; flip REGRESSION rows 15–16 to PASS

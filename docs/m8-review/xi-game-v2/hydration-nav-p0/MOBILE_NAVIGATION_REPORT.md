# MOBILE_NAVIGATION_REPORT

**Mode:** SIMULATED (Playwright iPhone 12 profile + CDP Slow-4G + CPU 4×)  
**Not** a headed physical-device capture.

## Config

| Knob | Value |
|------|-------|
| Viewport | 390×844 |
| Network | download ~1.6Mbps, upload ~750Kbps, RTT 150ms |
| CPU | 4× throttling |
| Client ready gate | `window.__xiNavReady && window.__xiUiHydrated` |

## Result

| Check | Result |
|-------|--------|
| Full Lobby→Hub→Play→Hub→Lobby | **PASS** (11988 ms wall) |
| Hydration errors during mobile pass | 0 (included in global counters) |
| Screenshot | `screenshots/mobile-lobby.png` |

## Notes

- Pre-hydrate clicks on Slow-4G can be dead; E2E waits for client-ready flags.  
- Soft nav + light veil used; no solid black leave overlay.  
- Physical device validation still recommended for commercial FPS claims (out of this P0 scope).

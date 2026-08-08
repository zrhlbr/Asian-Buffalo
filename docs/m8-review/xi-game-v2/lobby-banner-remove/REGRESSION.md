# REGRESSION — Lobby Banner Remove

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Banner gone (`xi-promo-login` / promo CSS / promo i18n) | **PASS** (code) | No matches in `.tsx/.ts/.css` |
| 2 | Home structure: top→hero→announce→rec→quick→bottom nav | **PASS** (code) | No new big banners |
| 3 | Activity Center OK | **PASS** (code) | Nav tab + quick modal |
| 4 | Check-in not deleted | **PASS** (code) | `CheckinPanel` + API helpers intact; entry via Activity |
| 5 | Shorter scroll / no odd gap above bottom nav | **PASS** (code) | Banner removed; main padding tightened |
| 6 | BDK recommended HOT → Hub entry | **PASS** (code) | `goLiveHref` / `navigateXi` unchanged |
| 7 | Coming Soon dimmer; no fake game click | **PASS** (code) | `.is-soon` styles; modal only |
| 8 | Quick ≥44px; red-dot; no dead buttons | **PASS** (code) | CS → coming_soon modal (honest) |
| 9 | Top bar 320–430 | **PASS** (code CSS) | Media 430/360 rules |
| 10 | Hero Journey + LOW static | **PASS** (code) | Art kept; LOW FX muted |
| 11 | Bottom nav safe-area | **PASS** (code) | `env(safe-area-inset-bottom)` |
| 12 | i18n zh/en/my | **PASS** | `assertLobbyI18nComplete` ok |
| 13 | Hub / Play files untouched this task | **PASS** | No edits to `bdk-hub` / `play-shell` / `m5` |
| 14 | Hydration / `#gl` / keep-alive | **PASS** (no-touch) | Shell/nav/lifecycle not edited |
| 15 | Headed device shots 320–430 / langs | **BLOCKED** | See `BLOCKED_CAPTURE.md` |
| 16 | Runtime hydration=0 / no black screen | **BLOCKED** | Needs headed browser run |

**Code-level closure:** PASS for allowed scope.  
**Visual/runtime headed evidence:** BLOCKED until device capture available.

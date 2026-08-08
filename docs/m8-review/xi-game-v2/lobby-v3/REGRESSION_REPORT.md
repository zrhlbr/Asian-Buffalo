# Lobby V3 — REGRESSION_REPORT

**Verify mode:** Code-path (static) — headed capture BLOCKED

| # | Case | Status | Evidence |
|---|------|--------|----------|
| 1 | Lobby `/xi` structure Top→Hero→Announce→Rec→Quick→Bottom | **PASS** | testids order lines 481→617→651→681→737→844 |
| 2 | No Daily Login big banner | **PASS** | no promo/daily banner markup |
| 3 | BDK HOT → hub nav path | **PASS** | `onRecGameClick` → `goLiveHref` → `XI_ROUTES.hub` |
| 4 | Coming Soon → modal only (no game start) | **PASS** | `setModal("coming_soon")`; no Dragon King auto-start |
| 5 | Announcements real API + honest empty | **PASS** | `fetchAnnouncements`; empty/error keys |
| 6 | Quick actions wired (no dead) | **PASS** | recharge/withdraw/activity/vip/rankings/announcements/cs handlers |
| 7 | Lang switch no reload | **PASS** | `saveLobbyLang` only |
| 8 | i18n parity zh/en/my | **PASS** | assert ok, 248 keys |
| 9 | Hub core untouched | **PASS** | `bdk-hub.tsx` not edited this package |
| 10 | Play shell / GameClient keep-alive untouched | **PASS** | `play-shell` / `game-host` / `layer-keepalive` / `game-lifecycle` / `xi-shell` / `nav` not edited |
| 11 | `#gl` translateZ / no `#hud` shell translateZ | **PASS** | host opacity-only rule preserved in CSS |
| 12 | Wallet / VIP / Auth entry surfaces | **PASS** | existing panels/entry retained; presentation-only breath |
| 13 | P0 hydration baseline | **PASS** | quality particles gated on `qualityHydrated`; lang server snapshot unchanged |
| 14 | P1 warm nav | **PASS** | no edits to nav/prefetch dispose paths |
| 15 | Headed lobby screenshots | **BLOCKED** | `BLOCKED_CAPTURE.md` |
| 16 | Hub/Play visual smoke | **BLOCKED** | needs headed device |

## Verdict

Code-path regression for Lobby V3 polish: **PASS**. Visual capture rows remain **BLOCKED** until headed run.

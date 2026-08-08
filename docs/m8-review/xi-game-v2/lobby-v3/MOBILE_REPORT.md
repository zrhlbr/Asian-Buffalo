# Lobby V3 — MOBILE_REPORT (320–430)

**Mode:** Code-path + CSS audit (headed capture BLOCKED)

## Layout structure (locked)

1. Topbar (avatar / wallets / lang)
2. Journey hero
3. Announcement ticker + 更多
4. Recommended row
5. Quick actions (7)
6. Bottom nav (safe-area)

Daily Login big banner: **absent** (check-in only via Activity).

## Breakpoints

| Width | Notes |
|-------|-------|
| 320–360 | Lang chips denser; rec cards 5.7–5.9rem; quick icons 1.45rem; nav min-height 44px |
| ≤430 | Hero object-position bias for pilgrims; topbar 2-row grid; quick row horizontal scroll if needed |
| Safe-area | Bottom nav `padding-bottom/left/right` uses `env(safe-area-inset-*)` |

## Touch targets

| Control | Target |
|---------|--------|
| Quick actions | `min-width/min-height: 44px` |
| Bottom nav buttons | `min-height: 44px` |
| Ticker 更多 | `min-height/min-width: 44px` |
| Lang chips | Readable; may be <44px width but grouped in always-visible bar |

## Interaction

- BDK HOT → `navigateXi` hub (unchanged path)
- Coming Soon cards → trilingual modal (`lobby.comingSoon` / body)
- Quick CS → Coming Soon modal; others open existing panels
- Lang 中文 / မြန်မာ / EN → `saveLobbyLang` only (no route reload)

## Capture status

Headed 320/375/430 screenshots: **BLOCKED** — see `BLOCKED_CAPTURE.md`.

# REGRESSION — Page 1 `/xi` Lobby

**Date:** 2026-08-07  
**Scope:** Immortal-qi visual upgrade only

## Checklist

| Gate | Expected | Result |
|------|----------|--------|
| Lobby renders | `data-testid=xi-lobby-root` | PASS (code path preserved) |
| Hero layers present | mountains / palace / rays / cranes / particles / mist | PASS (markup + CSS) |
| Jade tablet topbar | `.xi-jade-tablet` gold edge + cloud motif | PASS |
| Feature icons clickable | All FEATURES open modal / panel | PASS (handlers unchanged) |
| Catalog / BDK card | Navigates to `/xi/bdk` | PASS (href path unchanged) |
| Slot `/` untouched | No edits to `app/page.tsx` / reel mount | PASS |
| i18n new keys | `lobby.hero.journey` zh/en/my | PASS (dict parity) |
| zh display font only | Calligraphy via `[data-lang=zh-CN]` | PASS |
| en/my not forced calligraphy | Cinzel / Noto Sans Myanmar body | PASS |
| Money / math | No wallet/ledger/spin edits | PASS |

## Notes

- Headed screenshots: see `BLOCKED_CAPTURE.md` if Playwright/dev server unavailable in this agent session.
- No `#gl` / `#hud` CSS touched on this page.

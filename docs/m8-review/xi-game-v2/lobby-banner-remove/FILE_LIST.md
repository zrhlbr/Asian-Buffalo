# FILE_LIST — Lobby Banner Remove

## Modified (in scope)

| Path | Change |
|------|--------|
| `client/xi-lobby/lobby-app.tsx` | Removed `.xi-promo-banner` block; Activity Center check-in entry (nav + modal); quick label class |
| `client/xi-lobby/lobby.css` | Removed promo styles; rec HOT/soon contrast; quick unify ≥44px; top 320–430; bottom nav safe-area; main bottom gap; LOW hero more static |
| `client/xi-lobby/i18n.ts` | Removed unused `lobby.promo.*` keys (zh/en/my); kept `lobby.feat.checkin` / commerce / BDK check-in keys |

## Delivery docs

| Path |
|------|
| `docs/m8-review/xi-game-v2/lobby-banner-remove/MODULE_IMPACT_ANALYSIS.md` |
| `docs/m8-review/xi-game-v2/lobby-banner-remove/FILE_LIST.md` |
| `docs/m8-review/xi-game-v2/lobby-banner-remove/BEFORE_AFTER.md` |
| `docs/m8-review/xi-game-v2/lobby-banner-remove/REGRESSION.md` |
| `docs/m8-review/xi-game-v2/lobby-banner-remove/BLOCKED_CAPTURE.md` |
| `docs/m8-review/xi-game-v2/lobby-banner-remove/REVIEW_PATCH.md` |
| `docs/m8-review/xi-game-v2/lobby-banner-remove/AB-XI-LOBBY-BANNER-REMOVE-review.patch` |
| `docs/m8-review/xi-game-v2/lobby-banner-remove/SHA256.txt` |
| `docs/m8-review/xi-game-v2/lobby-banner-remove/git-status.txt` |
| `docs/m8-review/xi-game-v2/lobby-banner-remove/DELIVERY.md` |

## Explicitly NOT touched

| Path | Reason |
|------|--------|
| `client/xi-lobby/bdk-hub.tsx` | Hub forbidden |
| `client/xi-lobby/play-shell.tsx` | Play forbidden |
| `client/xi-lobby/game-host.tsx` / `game-lifecycle.ts` / `layer-keepalive.tsx` / `xi-shell.tsx` / `nav.ts` | Hydration / keep-alive / stacking |
| `client/xi-lobby/commerce-panels.tsx` | Check-in **business** kept (import only) |
| `client/m5/**` | Reel / Spin / Math forbidden |
| Wallet / Ledger / Auth / Admin / API routes | Forbidden |

## DB / Deploy

| Item | Status |
|------|--------|
| DB / Migration | **No** |
| Commit / Push / Merge / Deploy | **No** |

# BEFORE / AFTER — Lobby Banner Remove

## Structure

| | BEFORE | AFTER |
|---|--------|-------|
| Home order | Top → Hero → Announce → Recommended → Quick → **Daily login banner** → Bottom nav | Top → Hero → Announce → Recommended → Quick → Bottom nav |
| Banner | `data-testid="xi-promo-login"` + CTA `xi-promo-checkin` | **Removed entirely** (no placeholder) |
| Scroll | Extra banner height + margin above bottom nav | Shorter; main `padding-bottom` tightened to nav + safe-area |

## Check-in path (business preserved)

| Entry | BEFORE | AFTER |
|-------|--------|-------|
| Lobby standalone banner CTA | Opened `CheckinPanel` modal | **Gone** |
| Bottom nav → 活动 | Panel + 签到 button → `CheckinPanel` | **Kept** (`xi-nav-activity-open-checkin`) |
| Quick → 活动中心 modal | Activity list only | **+ 签到 button** (`xi-activity-open-checkin`) → same `CheckinPanel` |
| API / claim | `/api/v1/game/checkin` | Untouched |

## Recommended / Quick / Top / Hero

| Area | AFTER |
|------|-------|
| Recommended | 牛魔王 HOT brightest; Coming Soon dimmer + `lobby.rec.soon` / `lobby.comingSoon`; click → coming-soon modal (no fake live) |
| Quick | Unified icon size/height/centering; min 44px touch; activity red-dot; labels via `.xi-quick-label` |
| Top 320–430 | Tighter lang/actions; nowrap wallets scroll; no wrap mess |
| Hero | Journey art kept; LOW rays/clouds/mist near-static |
| Bottom nav | safe-area padding; no large empty gap after banner removal |

## i18n

| Keys removed | `lobby.promo.loginTitle` / `loginSub` / `claim` / `enter` (banner-only) |
| Keys kept | `lobby.feat.checkin`, `lobby.bdk.feat.checkin`, `lobby.commerce.*` check-in strings |
| Parity | `assertLobbyI18nComplete()` → **ok: true** (247 keys) |

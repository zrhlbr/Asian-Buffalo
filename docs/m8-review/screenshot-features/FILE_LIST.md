# FILE_LIST.md — Screenshot Feature Completeness

## Player (M8)

### New
- `lib/player-commerce-bootstrap.ts`
- `lib/player-profile.ts`
- `lib/vip-service.ts`
- `lib/vip-rewards.ts`
- `lib/game-route-auth.ts`
- `client/m5/ui/overlays.ts`
- `app/api/v1/game/profile/route.ts`
- `app/api/v1/game/profile/avatar/route.ts`
- `app/api/v1/game/profile/phone/route.ts`
- `app/api/v1/game/vip/route.ts`
- `app/api/v1/game/vip/levels/route.ts`
- `app/api/v1/game/vip/rewards/route.ts`
- `app/api/v1/game/vip/rewards/claim/route.ts`
- `app/admin/modules/vip.tsx`
- `public/avatars/ab-avatar-01.svg` … `ab-avatar-16.svg` (16 original placeholders)
- `tests/player-profile.test.mjs`
- `tests/vip-rewards.test.mjs`
- `docs/m8-review/screenshot-features/**`

### Modified
- `app/game-client.tsx` — profile/VIP/wallet/help buttons + modals
- `client/m5/ui/hud.ts` — CommerceOverlays wire + trap release
- `client/m5/styles.css` — modal pointer-events whitelist + commerce CSS (**no `#hud` translateZ**)
- `client/m5/i18n.ts` — trilingual overlay keys
- `lib/admin/admin-bootstrap.ts` — ensure commerce schema
- `lib/admin/admin-auth.ts` — vip:view/manage
- `lib/admin/admin-api.ts` — VIP admin routes
- `lib/admin/admin-queries.ts` — profile/VIP JOIN + phone mask
- `lib/admin/i18n.ts` — VIP keys zh/en/my
- `app/admin/admin-app.tsx` — VIP nav/module
- `app/admin/modules/players.tsx` — show nickname/avatarId/VIP

## Admin (M9) synced copies
Same admin/lib commerce files copied into `D:\Asian-Buffalo-R1-M9-Cursor-Clean` (no commit).

## Forbidden untouched
- Spin/math/RTP cores
- Destructive migrations
- `#hud { transform: translateZ(0) }`

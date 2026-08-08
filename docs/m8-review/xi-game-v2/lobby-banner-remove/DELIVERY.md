# DELIVERY STOP — Lobby Banner Remove

**Date:** 2026-08-08  
**Scope:** `/xi` lobby UI closure — remove Daily Login Reward banner  
**Git:** NO commit / push / merge / deploy  
**DB:** NO

---

## Summary

Standalone 【每日登录奖励 / 天天领好礼 / 查看签到】 banner removed from `/xi` home. Check-in business kept; reachable from 【活动中心】 (bottom nav + quick-action modal). Home structure: top → Hero → announce → recommended → quick → bottom nav.

## Files touched

1. `client/xi-lobby/lobby-app.tsx`
2. `client/xi-lobby/lobby.css`
3. `client/xi-lobby/i18n.ts`
4. `docs/m8-review/xi-game-v2/lobby-banner-remove/**` (delivery)

## Check-in path remaining

1. Bottom nav **活动** → button **签到** (`xi-nav-activity-open-checkin`) → `CheckinPanel`
2. Quick **活动中心** → modal → button **签到** (`xi-activity-open-checkin`) → `CheckinPanel`
3. Business: `commerce-panels.tsx` `CheckinPanel` + `api.ts` `fetchCheckin` / `claimCheckin` (untouched)

## Hub / Play untouched

- `client/xi-lobby/bdk-hub.tsx` — not edited
- `client/xi-lobby/play-shell.tsx` — not edited
- `client/m5/**` — not edited this task
- Hydration / `#gl` / keep-alive shell files — not edited

## Tests / gates

| Gate | Result |
|------|--------|
| i18n assertLobbyI18nComplete | PASS |
| Promo key/CSS/testid gone | PASS (grep) |
| Headed 320–430 / lang shots | BLOCKED (`BLOCKED_CAPTURE.md`) |
| tsc / eslint / vitest / build full suite | Not re-run (UI-only; recommend parent CI if required) |

## Risks

- Visual spacing on real devices needs headed confirmation (BLOCKED_CAPTURE)
- Activity modal now exposes check-in; Hub check-in entry unchanged (out of scope)

## Incomplete

- Device screenshots / runtime hydration=0 evidence

## Production conditions

- Not for deploy this package; UI-only local working tree changes

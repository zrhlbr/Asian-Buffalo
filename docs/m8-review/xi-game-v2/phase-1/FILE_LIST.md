# 《西游戏》V2 Phase 1 — FILE_LIST

## Implementation (new, additive)

| Path | Role |
|------|------|
| `lib/lobby-catalog.ts` | Static lobby catalog seed + types |
| `app/api/v1/lobby/catalog/route.ts` | `GET` catalog API |
| `client/xi-lobby/i18n.ts` | Lobby trilingual dict (zh-CN / en / my-MM) |
| `client/xi-lobby/api.ts` | Fail-closed profile/balance/announcements/catalog fetch |
| `client/xi-lobby/lobby.css` | Lobby shell styles (isolated from `#gl`/`#hud`) |
| `client/xi-lobby/lobby-app.tsx` | Lobby UI (hero, topbar, catalog, features, bottom nav) |
| `client/xi-lobby/bdk-hub.tsx` | `/xi/bdk` stub hub → `/game` or `/` |
| `app/xi/layout.tsx` | Lobby metadata |
| `app/xi/page.tsx` | `/xi` lobby page |
| `app/xi/bdk/page.tsx` | BDK hub stub page |
| `app/game/page.tsx` | Additive GameClient alias (same as `/`) |
| `tests/xi-lobby-phase1.test.mjs` | Unit smoke (catalog, i18n, routes, P0 stacking) |

## Delivery package (`docs/m8-review/xi-game-v2/phase-1/`)

- `MODULE_IMPACT_ANALYSIS.md`
- `西游戏_V2_第一阶段开发报告.md`
- `FILE_LIST.md`
- `REVIEW_PATCH.md`
- `AB-XI-GAME-V2-PHASE1-review.patch`
- `SHA256.txt`
- `RISK.md`
- `ROLLBACK.md`
- `GATE_RESULTS.md`
- `I18N_KEYS.txt`
- `ASSET_GAP.md`
- `_smoke-lobby.mjs`
- `screenshots/*.png`

## Intentionally unchanged

- `app/page.tsx` — still mounts playable slot
- `client/m5/**` — reels / math / wallet / P0 `#gl` stacking
- Admin UI (M8/M9) — sync pending (catalog read API only)

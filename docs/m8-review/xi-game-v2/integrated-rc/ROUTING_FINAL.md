# ROUTING_FINAL — 《西游戏》Integrated RC

## Canonical routes

| Route | Role | Component |
|-------|------|-----------|
| `/xi` | Platform lobby | `LobbyApp` |
| `/xi/bull-demon-king` | 《西游戏之牛魔王》 hub | `BdkHub` |
| `/xi/bull-demon-king/play` | 《牛魔王》 formal slot | `BdkPlayShell` → **single** `GameClient` |
| `/admin` | Admin console | `AdminApp` (login gate when unauthed) |
| `/admin/login` | Explicit login entry | same `AdminApp` |

## Compat redirects (no second game stack)

| From | To | Mechanism |
|------|----|-----------|
| `/` | `/xi/bull-demon-king/play` | `app/page.tsx` + `next.config.ts` 308 |
| `/game` | `/xi/bull-demon-king/play` | `app/game/page.tsx` + `next.config.ts` 308 |
| `/xi/bdk` | `/xi/bull-demon-king` | page + config 308 (Step1 legacy) |

## Feature placement

- **Lobby:** catalog, balance, commerce panels, VIP/activity/check-in, profile, announcements, lang
- **Hub:** start game, records/wins, rules/help shells, same commerce entry points (not a second wallet)
- **Play:** Session/Spin/Round + HUD only — commerce stays lobby/hub (walletPending copy)
- **Admin:** ops + finance modules; no orphan UI module without API family

## Smoke evidence

Compat redirects return **308** to canonical targets (`smoke-results.json`).

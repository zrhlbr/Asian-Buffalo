# Step 1 Lobby — FILE_LIST

| Path | Role |
|------|------|
| `app/xi/layout.tsx` | Lobby metadata title 西游戏 |
| `app/xi/page.tsx` | Mounts full `LobbyApp` |
| `app/xi/bull-demon-king/layout.tsx` | Stub layout metadata |
| `app/xi/bull-demon-king/page.tsx` | Minimal stub entry (NOT full hub) |
| `app/xi/bdk/page.tsx` | Legacy → `/xi/bull-demon-king` permanent redirect |
| `client/xi-lobby/lobby-app.tsx` | Full lobby UI |
| `client/xi-lobby/bdk-hub.tsx` | Stub only (title + 验收后开发 + back) |
| `client/xi-lobby/i18n.ts` | zh-CN / en / my-MM lobby keys |
| `client/xi-lobby/lobby.css` | Lobby + stub presentation CSS |
| `client/xi-lobby/api.ts` | Catalog/profile/balance/announcements fetch |
| `lib/lobby-catalog.ts` | BDK card `href: "/xi/bull-demon-king"` |
| `next.config.ts` | `/xi/bdk` → hub stub redirect |

**Explicitly NOT in Step 1 delivery:** `app/xi/bull-demon-king/play/**`, play-shell, full hub UI, admin modules, m5 spin/math.

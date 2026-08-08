# Lobby V3 — I18N_REPORT

## Scan

```
assertLobbyI18nComplete() → { ok: true, missing: [], keyCount: 248 }
```

Locales: `zh-CN` / `en` / `my-MM` — key parity **PASS**.

## V3 keys added

| Key | zh-CN | en | my-MM |
|-----|-------|----|-------|
| `lobby.comingSoon.toast` | 即将上线 | Coming soon | မကြာမီ |

Existing Coming Soon UX continues to use:

- `lobby.comingSoon`
- `lobby.comingSoon.body`
- `lobby.rec.soon`
- game title keys (`lobby.games.*.title`)

## Hardcode check (lobby V3 surface)

- UI copy via `tLobby` / `t(...)` — no new hard-coded Chinese in lobby markup
- Lang toggle labels remain always-visible script names: 中文 / မြန်မာ / EN (intentional product labels)

## Lang switch

- `saveLobbyLang` → localStorage + cookie + store emit
- No full page reload / no WebGL dispose path invoked from lobby lang buttons
- Target: &lt;300ms class flip (no hydration remount of shell) — code-path OK; timed capture BLOCKED

# I18N_REPORT — UI Layout V2

**Assert:** `assertLobbyI18nComplete()` → **ok: true** (zh-CN / en / my-MM parity)

## New / updated keys (all locales)

- `lobby.section.moreGames`, `lobby.section.quick`
- `lobby.ticker.default`, `lobby.ticker.more`
- `lobby.promo.loginTitle`, `lobby.promo.loginSub`, `lobby.promo.claim`
- `lobby.games.phoenix.title`, `lobby.games.caishen.title`, `lobby.games.wulinpanda.title`
- `lobby.feat.vip` / `lobby.feat.activity` labels (VIP中心 / 活动中心)
- `lobby.bdk.heroGap` → cleared copy; `lobby.bdk.heroReady` added
- `lobby.settings.body` points to top-bar 三语 toggles

## Language UX

| Surface | Behavior |
|---------|----------|
| `/xi` lobby | Always-visible **中文 / မြန်မာ / EN** — click switches immediately |
| `/xi/bull-demon-king` hub | Same toggles |
| Persist | `localStorage` key `xi-lobby-lang` |
| Play | Existing shell syncs `ab-lang` from lobby lang |

No language buried in settings-only path.

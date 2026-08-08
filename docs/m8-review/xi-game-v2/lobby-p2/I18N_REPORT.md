# I18N_REPORT — Lobby P2

## Locales

`zh-CN` / `en` / `my-MM` — keys must match.

## New / changed keys (P2)

| Key | Purpose |
|-----|---------|
| `lobby.ticker.empty` | Honest empty marquee (no fake winners) |
| `lobby.ticker.default` | Aligned to empty (was fake jackpot congrats) |
| `lobby.promo.enter` | Daily login CTA → open check-in (not client grant) |
| `lobby.rec.soon` | Coming Soon badge on recommended cards |

## Parity gate

```
assertLobbyI18nComplete() → { ok: true, missing: [] }
```

**REAL** — executed via `tsx` on 2026-08-08.

## Lang UX

- Always-visible toggles: 中文 | မြန်မာ | EN
- Gold active style (`.xi-lang-direct-btn.is-active`)
- No full reload — `saveLobbyLang` + `useSyncExternalStore`
- SSR default `zh-CN` via `getLobbyLangServerSnapshot()` (no cookie read on server)

## Cleanup

Removed duplicate `lobby.nav.home` entries in dict blocks (tsc TS1117).

# I18N_FINAL_REPORT — Integrated RC

## Lobby (`client/xi-lobby/i18n.ts`)

| Locale | Keys | Parity |
|--------|------|--------|
| zh-CN | 159 | baseline |
| en | 158 | PASS (false-positive `zh-CN` locale label only) |
| my-MM | 158 | PASS |

`assertLobbyI18nComplete()` green in unit + integrated-rc tests.

Brand strings: 西游戏 / 西游戏之牛魔王 / 牛魔王 (zh); XI GAME / Bull Demon King (en); Myanmar equivalents present.

## Slot (`client/m5/i18n.ts`)

zh-CN / en / my-MM structured parity; `gameTitle` = 牛魔王 / BULL DEMON KING / MM.

## Admin (`lib/admin/i18n.ts`)

Identical non-empty key sets zh/en/my — covered by `r1-m7-admin.test.mjs`.

## Lang sync

Play shell copies lobby lang → `ab-lang` for GameClient HUD.

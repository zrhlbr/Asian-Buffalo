# Step 2 — I18N Report

**Locales:** `zh-CN` / `en` / `my-MM`  
**Storage key:** `xi-lobby-lang` (shared with lobby — preserved on hub↔lobby)  
**Parity scan:** `assertLobbyI18nComplete()` → `ok: true`, `missing: []`  
**Total keys:** 125

## Hub titles

| Locale | `lobby.bdk.hubTitle` / page title |
|--------|-----------------------------------|
| zh-CN | 西游戏之牛魔王 |
| en | XI GAME · Bull Demon King |
| my-MM | XI GAME · နွားနတ်ဆိုးဘုရင် (formal Myanmar) |

## Primary CTA

| Locale | `lobby.bdk.startGame` | Loading |
|--------|----------------------|---------|
| zh-CN | 开始游戏 | 进入中… |
| en | Start game | Entering… |
| my-MM | ဂိမ်းစတင်မည် | ဝင်နေသည်… |

## Feature groups

| Group key | zh-CN | en | my-MM |
|-----------|-------|----|-------|
| `lobby.bdk.group.funds` | 资金 | Funds | ငွေကြေး |
| `lobby.bdk.group.member` | 会员 | Membership | အသင်းဝင် |
| `lobby.bdk.group.game` | 游戏 | Game | ဂိမ်း |
| `lobby.bdk.group.player` | 玩家 | Player | ကစားသမား |
| `lobby.bdk.group.service` | 服务 | Service | ဝန်ဆောင်မှု |

## Formal rules source

Rules / paytable / bet-help copy uses **Bull Demon King / Asian Buffalo formal** notes (`lobby.bdk.rules.*`, `paytable.*`, `betHelp.body`) — aligned with in-game formal i18n (5×4 / 50 lines / WILD / SCATTER server-authoritative). **No African Buffalo math copy.**

## Hardcoded UI scan

Hub + play-shell UI strings go through `tLobby` / `tLobby(lang, key)`. No user-visible hardcoded Chinese/English/Myanmar labels in `bdk-hub.tsx` / `play-shell.tsx`.

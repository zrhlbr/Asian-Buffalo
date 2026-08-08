# I18N Report — Hub↔Play loading

## New key (zh / en / my-MM)

| Key | zh-CN | en | my-MM |
|-----|-------|----|-------|
| `lobby.play.loading` | 西游戏加载中… | XI GAME loading… | XI GAME ဖွင့်နေသည်… |

## Checks

- `assertLobbyI18nComplete()` → OK  
- Static test: three `"lobby.play.loading"` occurrences  
- Locale nav Hub↔Play: zh-CN / en / my-MM OK  

## Overlay brand

Loading card shows brand mark `西游戏` plus translated `lobby.play.loading` (presentation chrome; key-driven body text).

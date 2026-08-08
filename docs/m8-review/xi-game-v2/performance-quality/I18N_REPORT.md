# I18N_REPORT — Quality settings

**Date:** 2026-08-07  
**Chrome lang toggles:** 中文 | မြန်မာ | EN (unchanged)

## Slot (`client/m5/i18n.ts`)

New keys (zh-CN / en / my-MM parity; `validateDicts` PASS in unit test):

| Key | zh-CN | en | my-MM |
|-----|-------|----|-------|
| qualityUltra | 旗舰 | Ultra | အမြင့်ဆုံး |
| fxEffects | 特效 | Effects | အထူးပြုလုပ်ချက် |
| fxOn / fxOff | 开 / 关 | On / Off | ဖွင့် / ပိတ် |
| animalAnim | 动物动画 | Animal anim | တိရစ္ဆာန် အန်နီမေးရှင်း |
| animalFull / animalSimple | 完整 / 简化 | Full / Simple | ပြည့်စုံ / ရိုးရှင်း |
| fpsTarget | 帧率 | FPS | FPS |
| fpsAuto / fps30 / fps60 | 自动 / 30 / 60 | Auto / 30 / 60 | အလိုအလျောက် / 30 / 60 |

## Lobby / Hub (`client/xi-lobby/i18n.ts`)

Mirrored under `lobby.quality.*` + updated `lobby.settings.body` (trilingual).

## Hard rule

No hardcoded English-only quality labels in new settings UI — all `data-i18n` / `t()` / `tLobby()`.

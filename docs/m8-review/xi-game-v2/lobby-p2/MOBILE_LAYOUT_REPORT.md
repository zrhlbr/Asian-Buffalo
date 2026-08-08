# MOBILE_LAYOUT_REPORT — Lobby P2

**Target widths:** 320–430 (primary), tablet/PC secondary  
**Evidence class:** CODE + CSS (screenshots BLOCKED)

## Top bar

- ≤520px: grid areas `user | actions` / `balances` full width
- ≤360px: tighter lang buttons + margins
- 三语 always visible (no dropdown)

## Journey Hero

| Width | object-position | Intent |
|-------|-----------------|--------|
| ≤430 | `42% 52%` | Keep Tang / Wukong / Bajie / Wujing in frame |
| 431–720 | `46% 54%` | Mid phones / small tablets |
| ≥900 | `50% 55%` | Desktop center |

## Recommended row

- Horizontal scroll, snap
- First card (BDK) eager image; others CSS motif + Coming Soon badge
- Card width shrinks at ≤360

## Quick actions

- 7 mythic icons; horizontal scroll on narrow
- No dead buttons (CS → Coming Soon modal; rankings → RankingsPanel)

## Bottom nav

- `env(safe-area-inset-bottom)` retained
- Labels: 首页/游戏/钱包/活动/我的

## Checklist

| Item | Result |
|------|--------|
| No large side gutters on 320–430 | PASS (CSS) |
| Hero not empty | PASS (progressive journey assets) |
| Bottom nav not clipped by home indicator | PASS (safe-area) |
| Lang labels readable at 320 | PASS (≤360 font scale) |

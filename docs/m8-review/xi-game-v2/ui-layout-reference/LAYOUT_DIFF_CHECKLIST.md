# LAYOUT_DIFF_CHECKLIST — vs Zhao lobby reference

**Reference:** `zhao-lobby-reference.png` / `screenshots/00-reference.png`  
**After:** `screenshots/01-lobby-phone-after.png`

| # | Section | Reference | Implementation | Match |
|---|---------|-----------|----------------|-------|
| 1 | Top bar | avatar \| nick+ID+VIP \| MMK+ \| USDT+ \| 消息 \| 设置 \| 三语直显 | Same order; lang = 中文 / မြန်မာ / EN always visible | **PASS** |
| 2 | Full Hero | 西天取经 painting, figures complete | `/xi/journey-hero.png` cover + FX `pointer-events: none` | **PASS** |
| 3 | Ticker | speaker + scroll + 更多 | Under hero; default/API text | **PASS** |
| 4 | 推荐游戏 | 牛魔王 HOT gold → 龙王/凤凰/财神/武林熊猫 + JACKPOT | Horizontal cards; BDK → hub | **PASS** (card art placeholders) |
| 5 | 快捷功能 | 充值/提现/活动中心/VIP中心/排行榜/公告/客服 | Same order, 7 icons | **PASS** |
| 6 | Promo | 每日登录奖励 + 立即领取 | Opens check-in | **PASS** |
| 7 | Bottom nav | 首页/游戏/钱包/活动/我的 active gold/red | Fixed nav + active chrome | **PASS** |

## Page 2 hub (BDK)

| Item | Status |
|------|--------|
| Same top chrome + 三语 | PASS |
| Official BDK hero `/xi/heroes/bull-demon-king.png` | **PASS** (wired 2026-08-07) |
| Magma/flame ambience | PASS (ambient CSS) |
| 开始游戏 → play | PASS |
| Breadcrumb Lobby → Hub | PASS |
| ASSET_GAP badge | **REMOVED** |

## Page 3 play

| Item | Status |
|------|--------|
| Slot untouched (no reel/spin/math) | PASS |
| Back → hub | PASS |
| `#gl { transform: translateZ(0) }` kept in `client/m5/styles.css` | PASS |

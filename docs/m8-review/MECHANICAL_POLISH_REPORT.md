# M8 Mechanical Polish Report（持续完善轮）

**Branch:** `feature/ab-r1-m8-cursor`  
**Base HEAD:** `9654d41`（未 Commit / 未 Push / 未 PR）  
**Scope:** 商业视觉 / 机械细节 / 真机布局 — 无新业务功能

## P0 游戏框贴边

| Viewport | Fill | Left gutter | Right gutter | Result |
|---|---|---|---|---|
| 844×390 landscape | 0.994 | 3.0px | 2.2px | PASS |
| 915×412 landscape | 0.994 | 3.2px | 2.4px | PASS |
| 844×390 notch sim | 0.994 | 3.0px | 2.2px | PASS |
| 390×844 portrait | 0.952 | 9.3px | 9.3px | PASS |
| 412×915 portrait | 0.952 | 9.9px | 9.8px | PASS |
| 430×932 portrait | 0.952 | 10.3px | 10.2px | PASS |
| 1280×720 PC | 0.880 | ~77px | ~77px | PASS（PC 允许留白） |

证据：`docs/m8-review/perf/fill-probe.json`  
截图：`screenshots/edge-844x390-*`, `04-phone-landscape-idle.png`

### 本轮关键改动
- Phone landscape FOV **38°**；PC FOV **46°**（按 shortSide 判定，不再误伤 16:9）
- Safe-area pad → fill ratio；横屏目标 fill ≤ **0.998**
- 修复 portrait `Math.max(aspect, 0.5)` 过裁
- 金属外轨减薄（`OUTER_RAIL` 0.42→0.14），避免厚轨被当成左右留白
- `measureScreenFill` 运行时 NDC 验收

## Reel 商业质感
- 双层金属轨 + mid bevel + 内唇 AO
- 玻璃高光条、顶底滚动遮罩、收紧 Glow
- Stop 回弹保持；不遮挡 Symbol 主体

## HUD
- Currency 标签（钱包返回币种，展示-only）
- Session pill（OK / offline 样式）
- 横屏 console `transform:none` 全宽；Spin 为最强焦点
- 触摸区 min-height ≥ 44px（Turbo/Auto）

## 未达最终商业验收的项
- Symbol 源资产仍有批次差（见 Symbol 审核表）
- buffalo.png 源图为标题卡，运行时裁剪仅为过渡
- 真机 headed FPS / 10 分钟内存：**未测**
- Big Win / 完整试玩视频：本轮有 Playwright 录制片段，非赵总真机实拍

## 商业诚实评分（更新）

| 维度 | 分 | 说明 |
|---|---|---|
| Reel 贴边 / 主体 | 91 | 横屏实测 ~99.4% fill |
| Reel 金属质感 | 84 | 减薄后更贴手机，厚度感略弱 |
| HUD 统一 | 86 | Currency/Session 补齐；缅文长文案仍需盯 |
| Symbol 统一 | 72 | 审核表有 FAIL / PARTIAL |
| 场景 / Buffalo | 78 | 背景让位 Reel；主角精修未完 |
| 中奖演出 | 80 | UI-only；真机节奏未测 |
| 音效 | 75 | 后台恢复路径存在；真机未测 |
| 整体商业感 | **82.3** | 未达 ≥90 最终验收线 |

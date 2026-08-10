# Reel 转动方向修正报告

## 问题
原实现 `cellY(r, frac)` 使用 `+ frac`，`pos` 增加时 Symbol **Y 增大** → 视觉为**由下往上**。

## 修正（仅视觉）
文件：`client/m5/game/reels.ts`

1. **主方向向下**：`cellY` 改为 `- frac`（frac↑ → Y↓）  
2. **条带索引**：`stripIndex = base - r + (ROWS - 1)`，保证向下滚动连续、新符从顶部进入  
3. **序列编码**：`toSpinSeq(col) = reverse(col)`，停轮后仍映射为服务端 row0=顶  
4. **回弹**：正 `extraFrac` 先轻微下冲，再向上归位（非整段反转）  
5. **Turbo / Auto / Free**：共用 `spinAll` → `reel.spin`，方向一致  
6. **Recovery**：`setGrid` 无滚动动画，编码与停轮一致  

未改：Grid / RNG / RTP / Session / Spin API / Wallet / Ledger。

## 测试
`tests/r1-m8-reel-direction.test.mjs` — **8/8 PASS**（含 commercial 合计 15/15）

覆盖：向下位移、wrap 连续性、停轮 Grid、bounce 符号、turbo 同路径、recovery setGrid。

## 证据视频（浏览器）
| 项 | 文件 |
|---|---|
| 普通 Spin | `video/reel-dir-normal-spin-browser.webm` |
| Turbo Spin | `video/reel-dir-turbo-spin-browser.webm` |
| 手机横屏 | `video/reel-dir-phone-landscape-browser.webm` |
| Free Spin 氛围尝试 | `video/reel-dir-freespin-attempt-browser.webm` |

探针：`perf/reel-direction-result.json`

## Patch
- `docs/m8-review/AB-K1-R1-M8-reel-direction.patch`
- SHA-256：见 `REEL_DIRECTION_SHA256.txt`

**未 Commit / Merge / Push / PR — 停笔待复审。**

# R1-M8 游戏特效 + 全动物动态升级 — 交付包

**基线 HEAD:** `9654d4194d2db801467af34cef1ddc5650fd310f`  
**范围:** 仅视觉 / 音效 / 性能 LOD（presentation-only）  
**禁止项:** 未 Commit / Merge / Push / PR；未改 Session/Spin/Round/Wallet/Ledger/RTP/Math

## 1. Review Patch

- `docs/m8-review/fx-animal/REVIEW.patch`
- `docs/m8-review/fx-animal/REVIEW-tracked.diff`

## 2. SHA-256

见 `docs/m8-review/fx-animal/BUNDLE.sha256` 与 `SYMBOL_LIFE.sha256`。

## 3. 修改文件清单

| 文件 | 变更 |
|---|---|
| `client/m5/game/symbol-life.ts` | **新增** 动物/Wild/Scatter Shader 生命动画 |
| `client/m5/game/reels.ts` | Reel 单元格改用 ShaderMaterial；中奖光圈/描边；LOD |
| `client/m5/scene/buffalo.ts` | 新增 `jackpot()` 逼近镜头；contract 导出 |
| `client/m5/game/game.ts` | 动物中奖音效；Jackpot→buffalo.jackpot；高亮传 grid |
| `client/m5/audio.ts` | `animalCue()` 失败软降级 |
| `client/m5/quality.ts` | `symbolAnimIntensity` 高/中/低 |
| `client/m5/boot.ts` | 画质切换同步 symbol LOD |
| `tests/r1-m8-symbol-life.test.mjs` | **新增** 契约测试 |

## 4. 动物动画清单

正式 SymbolId（无 tiger/deer — 数学集为 lion/antelope）：

| Symbol | Idle 呼吸 | 眨眼 | 转头/眼神 | 耳朵 | 毛发/高光 | 中奖强化 |
|---|---|---|---|---|---|---|
| buffalo（Reel 贴图） | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ 金边/放大 |
| lion | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| elephant | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| zebra | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| antelope | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 3D Buffalo 角色 | 呼吸/眨眼/注视/耳尾/鼻息雾 | | | | 毛皮 shell | roar/run/victory/bigWin/**jackpot** |

## 5. 特效清单

- 普通中奖：Symbol 放大 + tint + 金色描边脉冲 + 扩散光圈 + 粒子（既有）+ 线奖依次展示
- Wild：金属扫光 + 蓝金能量脉冲 + 中奖光环色
- Scatter：太阳/射线/粒子聚集感 + 橙色光环；FS 仍走服务端 `awardedFreeGames`
- Reel：保持 top→bottom；停轮回弹；Turbo 同向
- Big/Mega/Ultra/Jackpot：既有金币雨/震动/bloom + Jackpot 水牛镜头压迫
- 背景：既有动态天空/云/草/鸟/雾/God Rays（质量档位控制）

## 6. 性能报告

| 项 | 状态 |
|---|---|
| 高画质 | `symbolAnimIntensity=2`，完整粒子/Bloom/GodRays |
| 中画质 | intensity=1，粒子/草降低 |
| 低画质 | intensity=1（保留眨眼/呼吸/中奖），DPR≥2，关 Bloom/GodRays |
| 单元测试 | `r1-m8-symbol-life` + reel-direction + clarity + commercial = **27/27 PASS** |
| Android / iPhone 真机 FPS | **未在本轮实测**（见风险） |
| 10 分钟内存 | **未测** |

## 7. 风险报告

1. Shader 生命动画为 UV/顶点近似，非骨骼动画 — 近距离可能不如真骨骼自然。
2. 真机（Android/iPhone）FPS / 长稳内存未采集 — 需赵总手机复测。
3. 规格文案中的 tiger/deer/phoenix 不在正式 `SymbolId`；本轮按 lion/antelope 实现，未改数学符号集。
4. Jackpot 逼近镜头若与侧边安全区冲突，已限制在 reels 左侧 home 走廊。

## 8. 回滚方案

1. 删除 `client/m5/game/symbol-life.ts`
2. 还原 `reels.ts` 单元格为 `MeshBasicMaterial`（git checkout）
3. 还原 `buffalo.ts` / `game.ts` / `audio.ts` / `quality.ts` / `boot.ts`
4. 删除 `tests/r1-m8-symbol-life.test.mjs`
5. 无需 DB / API 回滚（零服务端变更）

## 9–16. 视频 / 截图

| 交付项 | 状态 |
|---|---|
| Buffalo 待机 / 咆哮 / 胜利视频 | **待真机/浏览器采集**（逻辑已接线；见下方复测步骤） |
| 全动物中奖动画视频 | 待采集 |
| Big/Mega/Ultra/Jackpot 视频 | 待采集 |
| Android / iPhone 真机视频 | 待采集 |
| PC / 平板 / 手机截图 | 待采集 |

### 最快复测步骤

1. 启动正式链路本地服（`npm run dev`，FormalGameProvider）
2. 打开浏览器横屏；`__game.buffalo.roar()` / `victory()` / `jackpot()`（DEV）
3. 正常 Spin 观察动物贴图呼吸/眨眼与中奖金边
4. 切换 Quality high/medium/low 确认不掉清晰度

---

**独立复审等待中。未 Commit。**

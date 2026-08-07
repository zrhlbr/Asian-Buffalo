# R1-M6 接手核查报告（Cursor）

**日期：** 2026-08-06  
**审计模式：** 只读（未修改 Kimi 原工作区）  
**状态：** 已创建干净工作区；**尚未开始正式 M6 开发编码**

---

## 1. Cursor 干净工作区预检

| 项 | 结果 |
|---|---|
| 路径 | `D:\Asian-Buffalo-R1-M6-Cursor-Clean` |
| 分支 | `feature/ab-r1-m6-cursor` |
| HEAD | `9654d4194d2db801467af34cef1ddc5650fd310f`（正式 M5） |
| `git status --short` | **CLEAN** |
| 与 Kimi 共用目录 | **否** |
| remote origin | `https://github.com/zrhlbr/Asian-Buffalo.git` |
| 基线是否为 M5 | **是**（非 main / 非 4049348） |

禁止使用的污染路径均未作为开发根使用。

---

## 2. Kimi M6 交接源（只读）

| 项 | 结果 |
|---|---|
| 工作区路径 | `C:\Users\zhaor\Documents\kimi\workspace\Asian-Buffalo` |
| 分支 | `feature/ab-r1-m6` |
| HEAD | `4049348f4b7673694de16e4ef55fd306c5b390c8`（**M4，非正式 M5**） |
| `git status` | 脏：修改 `app/game-client.tsx` / `package.json` / `package-lock.json`；未跟踪 `app/m6/` 等 |
| Review 资产目录 | `C:\Users\zhaor\Documents\kimi\workspace\m6-review-assets` |
| 与 Cursor M6 共用目录 | **否** |

### 已修改 / 新增文件清单（Kimi）

**Modified**
- `app/game-client.tsx`（+345 行量级，接入 M6 场景/音效/三语/画质）
- `package.json`（加入 `three@^0.180.0`、`@types/three`）
- `package-lock.json`

**Untracked (核心)**
- `app/m6/**`（13 源文件）
- `m6-capture.tmp.mjs`
- `test-output.log` / `server.log` / `server.pid`

**未发现**
- M6 Review Patch
- M6 SHA-256SUMS
- 正式 Handoff Markdown（风险/回滚/完整测试报告）
- 完整演示视频（仅 `frames/f000.jpg` + capture 元数据）

---

## 3. Kimi 已完成内容（可复用方向）

只读复制已归档至：`docs/m6-handoff/kimi-readonly/`（25 文件）。

| 模块 | 路径 | 评估 |
|---|---|---|
| 草原场景 | `app/m6/scene/savanna.ts` | 可复用：天空/云/草/雾/金时光照 |
| Buffalo rig | `app/m6/scene/buffalo.ts` | 可复用：毛发壳层、待机/跑/吼等 |
| 场景编排 | `app/m6/scene/index.ts` | 可复用思路；需对接 M5 `boot`/`World` |
| 后处理 | `app/m6/scene/postfx.ts` | 可复用：Bloom/GodRay/DoF 开关 |
| 画质 LOD | `app/m6/quality.ts` | **高价值**：high/medium/low + 自动降级 |
| 音效引擎 | `app/m6/audio-engine.ts` | 可复用：WebAudio 合成、静音、总线 |
| 大奖演出 | `app/m6/components/WinCelebration.tsx` | 可复用：UI_ONLY 分级 + 粒子池 |
| 连线覆盖 | `app/m6/components/PaylineOverlay.tsx` | 可复用到 M5 HUD/reel |
| Reel 时序 | `app/m6/reel-motion.ts` | 可参考参数，需并入 `client/m5/game/reels.ts` |
| 三语 | `app/m6/i18n.ts` | 键表可合并进 `client/m5/i18n.ts` |
| 样式 | `app/m6/m6.css` | 可选择性吸收，避免双 HUD |

截图资产（部分）：idle-zh / spinning / settled-paylines / locale-en / locale-my / rules-overlay。

测试日志：`178/178` PASS（**M4 套件**，非 M5 的 192）。

---

## 4. Kimi 未完成 / 缺口

| 缺口 | 证据 |
|---|---|
| **未基于正式 M5** | HEAD=`4049348`，无 `client/m5`、无 `FormalGameProvider` |
| **正式路径仍用客户端演示数学** | `game-client.tsx` 调用 `createDemoGrid` + `evaluateSpin` |
| 大奖截图 / Free Spin 截图 | `celebrationShots: 0`, `freeSpinShot: false` |
| 演示视频 | 仅 1 帧 `f000.jpg` |
| Review Patch / SHA-256 | 缺失 |
| 手机/平板完整性能报告 | capture 中 FPS 数值异常偏高（疑似不可信） |
| 与 Session/Spin/Round/Recovery 正式接线 | 未见 |
| `window.__game` 生产门控 | 未在 M5 正式 boot 上验证 |
| 音量滑条 / 画质设置完整三语覆盖 | 部分有，需对照 M6 指令清单补齐 |

---

## 5. 已知风险与 Bug

1. **基线冲突（阻断级）**  
   Kimi M6 建在 M4 演示客户端上；Cursor 必须以 `9654d41` M5 为唯一正式基础。  
   **不得**直接把 Kimi `game-client.tsx` 覆盖进 M5。

2. **双前端风险**  
   Kimi：`app/m6` + 旧 2D HUD；正式 M5：`client/m5` Three + HUD。  
   合并策略必须是「能力迁入 `client/m5`」，不是并行两套可运行前端。

3. **three 版本**  
   Kimi：`^0.180.0`；M5：`0.166.1`。需统一并做兼容验证，避免重复装两套。

4. **业务边界**  
   Kimi 客户端本地算奖路径与 R1-M5/M6 禁令冲突，**整段丢弃**。

5. **交付物不完整**  
   无正式 Patch/视频/大奖与 FS 截图，Cursor 需在 M5 基线上补齐。

---

## 6. 只读复制结果

| 目标 | 状态 |
|---|---|
| `docs/m6-handoff/kimi-readonly/app-m6/` | 已复制 |
| `docs/m6-handoff/kimi-readonly/review-assets/` | 已复制 |
| `docs/m6-handoff/kimi-readonly/snapshots/` | kimi-game-client / package / capture / test log |
| Kimi 原树 | **未修改** |

---

## 7. 结论

- 接手条件满足：干净工作区、正确 M5 基线、Kimi 成果已只读归档。  
- **存在架构冲突**：Kimi 成果不能原样落地，必须「拆解复用 → 迁入正式 `client/m5`」。  
- 下一步按《实施计划》执行；在合并任何 Kimi 源码前，以正式 `FormalGameProvider` 路径为唯一权威。

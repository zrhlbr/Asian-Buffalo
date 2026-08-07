# R1-M6 实施计划（Cursor · 基于正式 M5）

**基线：** `9654d4194d2db801467af34cef1ddc5650fd310f`  
**分支：** `feature/ab-r1-m6-cursor`  
**原则：** 先复用 Kimi 表现层能力，再补缺口；不重写 M5；不碰 M1–M4。

---

## A. 复用策略（Adopt / Adapt / Reject）

### Adopt（高优先直接迁入 `client/m5/`）

| Kimi 源 | 迁入目标 | 说明 |
|---|---|---|
| `quality.ts` | `client/m5/quality.ts` | LOD / 自动降级 |
| `audio-engine.ts` | 增强 `client/m5/audio.ts` 或并行模块后统一导出 | 静音、总线、不重建 Context |
| `WinCelebration.tsx` 中的分级阈值 + 粒子池思路 | `client/m5` HUD/celebration | **UI_ONLY**，对齐/统一现有 `winTier` |
| `PaylineOverlay` 思路 | `client/m5` reel highlight / HUD | 仅展示服务端 `lineWins` / positions |
| `savanna.ts` / `buffalo.ts` / `postfx.ts` 精华 | 升级 `client/m5/scene/*` | 不新建第二套可运行前端 |
| `i18n.ts` 缺失键 | 合并入 `client/m5/i18n.ts` | 三语 key 对齐 |

### Adapt（需改写后接入）

| 内容 | 原因 |
|---|---|
| `scene/index.ts` / `SceneHost.tsx` | M5 已有 `boot.ts` + `World`；合并编排，禁止双 Renderer |
| `reel-motion.ts` | 并入 `client/m5/game/reels.ts` 时序，结果仍只吃服务端 grid |
| `m6.css` | 吸收设置面板/画质控件样式，不替换整套 M5 HUD |

### Reject（明确不采用）

| 内容 | 原因 |
|---|---|
| Kimi `game-client.tsx` 整文件 | 含 `createDemoGrid` / `evaluateSpin`，破坏正式路径 |
| 以 `app/m6` 为第二运行时入口 | 违反「单一正式前端」与 M5 集成成果 |
| 基于 `4049348` 继续开发 | 必须基于 M5 `9654d41` |
| 修改 Wallet/Ledger/Math/API/DB | 指令禁止 |
| 默认开启 TEST Identity / 生产开放 `__game` | 安全禁令 |

---

## B. 开发阶段

### Phase 0 — 冻结边界（已完成）
- [x] 干净工作区
- [x] Kimi 只读归档
- [x] 核查报告

### Phase 1 — 表现层骨架对齐（已完成）
- [x] `client/m5/quality.ts` + FPS 降级钩子
- [x] three 保持 `0.166.1`（拒绝升到 0.180）
- [x] 三语缺失键 + `validateDicts` 测试
- [x] `__game` → `allowDebugHooks()` 门控

### Phase 2 — Buffalo / 场景强化（已完成核心）
- [x] 毛发壳 LOD / 耳尾转头 / 可中断动作
- [x] God Rays（画质门控）/ 风向 / FS 氛围
- [x] 后处理按档开关；low 关 Bloom/DoF/GodRays
- [x] Spin 开始时 `buffalo.interrupt()`

### Phase 3 — Reel / Symbol / 连线（已完成核心）
- [x] 弹性回弹 / Turbo 时序精修
- [x] 多线依次展示（仅服务端 `lineWins`）
- [x] Recovery 恢复 grid + FS 氛围

### Phase 4 — 大奖 / 音频（已完成核心）
- [x] `WIN_TIERS_UI_ONLY` 标注；点击跳过庆祝
- [x] 音量 / 后台降音 / 环境音；不重建 AudioContext

### Phase 5 — 性能与多端（进行中）
- [x] 粒子预算 / 后台停渲染 / 画质降级
- [x] build PASS；`test:unit` **199/199**；tsc 基线 5 errors；`git diff --check` clean
- [ ] PC / 平板 / 手机截图 + FPS/内存/首屏指标
- [ ] lint 全量（需 Git Bash sites-env）

### Phase 6 — 交付（禁止 Commit/Push/PR）
- [ ] Review Patch（UTF-8）、SHA-256、清单、复用/未采用表、测试/性能/风险/回滚、截图与演示视频

---

## C. 冲突确认

| 冲突 | 处理 |
|---|---|
| Kimi 基线 ≠ M5 | **以 Cursor M6 工作区 9654d41 为准** |
| 双客户端 | **只增强 `client/m5`** |
| 本地算奖 | **拒绝** |
| 目录污染 | 已隔离；不操作 Kimi 树 |

**无文件系统冲突；存在架构冲突，已在计划内消化。**  
下一动作：按 Phase 1 开始正式开发（不覆盖 Kimi 原树，不丢弃归档）。

---

## D. 禁止事项（全程）

- Commit / Merge / Push / PR  
- 改 M5 Commit `9654d41`  
- 改 M1–M4 / Math / Wallet / Ledger / DB / API 契约  
- Mock 作为正式默认路径  
- 未显式 `AB_ALLOW_TEST_IDENTITY=1` 时开启 TEST Identity  

# R1-M6 开发状态（Cursor）

**更新：** 2026-08-06  
**工作区：** `D:\Asian-Buffalo-R1-M6-Cursor-Clean`  
**分支：** `feature/ab-r1-m6-cursor`  
**HEAD 基线：** `9654d4194d2db801467af34cef1ddc5650fd310f`（未改写正式 M5 commit）  
**禁止：** Commit / Merge / Push / PR（待独立复审）

---

## 工作区修复记录

接手后曾短暂被切到 `feature/ab-r1-m5-integration` 并出现 M5 残留暂存文件。  
已恢复为：

| 项 | 值 |
|---|---|
| 分支 | `feature/ab-r1-m6-cursor` |
| HEAD | `9654d41…` |
| 业务污染 | 已清除 |
| 仅保留未跟踪 | `docs/m6-handoff/` + 开发中的 M6 改动 |

Kimi 原树未修改。

---

## 已落地（基于正式 `client/m5`）

### Adopt from Kimi（迁入，非并行 runtime）

| 能力 | 落点 |
|---|---|
| Quality LOD + FPS 降级 | `client/m5/quality.ts` → `boot.ts` / `world.applyQuality` |
| God Rays（画质门控） | `client/m5/scene/world.ts` |
| 免费旋转氛围 | `World.setFreeSpinMood` |
| Buffalo 毛发壳 / 可中断动作 / 耳尾转头 | `client/m5/scene/buffalo.ts` |
| 音量 / 后台降音 / 环境音 | `client/m5/audio.ts` |
| 设置面板（画质+音量）三语键 | `app/game-client.tsx` + `hud.ts` + `i18n.ts` |
| `__game` 生产门控 | `allowDebugHooks()` in `boot.ts` |
| UI_ONLY 奖级标注 | `WIN_TIERS_UI_ONLY` in `adapter.ts` |
| 多线依次高亮 | `Game.presentPaylines`（仅服务端 lineWins） |
| Reel 弹性回弹精修 | `reels.ts` |

### Reject（未采用）

| 内容 | 原因 |
|---|---|
| Kimi `game-client.tsx` | 含 `createDemoGrid` / `evaluateSpin` |
| `app/m6` 第二运行时 | 违反单一正式前端 |
| 基于 `4049348` 开发 | 必须以 M5 `9654d41` 为基线 |
| three 升到 0.180 | 保持 M5 锁版本 `0.166.1`，避免双套 |

---

## 测试快照

- `tests/r1-m6-presentation.test.mjs`：**7/7 PASS**
- 全量 unit（含 dist）：**199/199 PASS**
- `vinext build`：**PASS**（Git Bash + `igncr`）
- `npx tsc --noEmit`：**5 基线错误**（`db/index` / `examples/d1` / `worker`；与 M5 一致；`docs/m6-handoff` 已 exclude）
- `git diff --check`：**clean**

---

## 仍待完成（进入交付前）

1. 正式 `npm run build` / `npm test` / lint / `tsc --noEmit` / `git diff --check`（Git Bash 环境）
2. PC / 平板 / 手机截图与演示视频
3. 性能数字报告（FPS / 内存 / 首屏）
4. Review Patch + SHA-256 + 复用/未采用清单终稿
5. 风险 / 回滚报告
6. 浏览器实机试玩验收（FormalGameProvider 路径）

---

## 边界确认

- 未修改 Wallet / Ledger / Math / DB / Migration / API 契约  
- 未默认开启 Mock / TEST Identity  
- 未 Commit / Push  

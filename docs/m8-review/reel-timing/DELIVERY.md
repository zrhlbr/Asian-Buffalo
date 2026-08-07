# R1-M8 Reel 速度 / 10 秒普通 Spin — 交付

**基线 HEAD:** `9654d4194d2db801467af34cef1ddc5650fd310f`  
**范围:** 仅视觉转轴时长与速度  
**未改:** Session / Spin API / Grid / RNG / RTP / Wallet / Ledger / Balance  
**未:** Commit / Merge / Push / PR

## 集中配置（`client/m5/game/reel-timing.ts`）

| 常量 | 值 |
|---|---|
| `NORMAL_SPIN_TOTAL_MS` | **10000** |
| `NORMAL_REEL_STOP_MS` | **[8000, 8400, 8800, 9200, 9700]** |
| `NORMAL_BOUNCE_MS` | 300（末列停后回弹 → 合计 ≈ 10.0s） |
| `TURBO_SPIN_TOTAL_MS` | **2500** |
| `TURBO_REEL_STOP_MS` | [1400, 1650, 1900, 2150, 2350] |
| `TURBO_BOUNCE_MS` | 150 |
| `SPIN_SPEED_MULT` | **1.35**（≈1.25–1.5 调试带） |
| 运动曲线 | `spinMotionProgress`：加速 → 高速匀速 → 晚段减速 |

## 实测各列停止时间（配置即契约）

| 列 | 普通停止 | Turbo 停止 |
|---|---|---|
| 1 | 8.00 s | 1.40 s |
| 2 | 8.40 s | 1.65 s |
| 3 | 8.80 s | 1.90 s |
| 4 | 9.20 s | 2.15 s |
| 5 | 9.70 s | 2.35 s |
| 全部归位（含回弹） | **≈ 10.00 s** | **≈ 2.50 s** |

允许误差 ±200 ms（帧率/主线程抖动）。

## Free Spin / Auto

- **Free Spin:** 与普通相同（`spinAll(grid, this.turbo)`；非 Turbo 时走 10s）
- **Auto:** 普通节奏 10s；`busy` 锁防止并发；局间间隔 turbo 250ms / 普通 600ms
- **Turbo:** 独立 ~2.5s，方向仍向下

## 安全行为（既有 + 保持）

- Spin 期间 `busy` 锁定，结束后解锁
- API 失败：立即解锁 + toast，不空转伪造结果
- 结果展示在 `await spinAll` 之后（含回弹）
- 恢复走 `setGrid`，不重放第二个 10s

## 修改文件清单

1. `client/m5/game/reel-timing.ts` **新增**
2. `client/m5/game/reels.ts` — 接入集中时长 / 更快 strip / cruise 曲线 / 回弹后 resolve
3. `tests/r1-m8-reel-timing.test.mjs` **新增**
4. `tests/r1-m8-reel-direction.test.mjs` — 同步 spinAll 契约

## Review Patch / SHA-256

- Patch: `docs/m8-review/reel-timing/REVIEW.patch`
- Bundle SHA-256: 见 `BUNDLE.sha256`
- Module SHA-256: 见 `REEL_TIMING.sha256`

## 测试

```text
node --experimental-strip-types --test \
  tests/r1-m8-reel-timing.test.mjs \
  tests/r1-m8-reel-direction.test.mjs \
  tests/r1-m8-symbol-life.test.mjs
→ 22/22 PASS
```

## 视频交付状态

| 项 | 状态 |
|---|---|
| 普通 Spin 10 秒完整视频 | **待浏览器/手机录屏**（逻辑已按 10s 配置） |
| Turbo Spin 视频 | 待录屏 |
| Free Spin 视频 | 待录屏（节奏=普通 10s） |
| 手机横屏录屏 | 待录屏 |

复测：`npm run dev` → 普通 Spin 用秒表；DEV 下可看列停顺序。

## 回滚

```bash
rm client/m5/game/reel-timing.ts tests/r1-m8-reel-timing.test.mjs
git checkout -- client/m5/game/reels.ts tests/r1-m8-reel-direction.test.mjs
```

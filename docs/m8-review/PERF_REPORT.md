# 性能报告 — R1-M8 Phase 2

## 已测
| 项 | 结果 |
|---|---|
| 布局探针多尺寸 | 全 PASS（见 `perf/fill-probe.json`） |
| M8 单测 | 7/7 PASS |
| Buffalo WebP 512 | 已产出并行资源 |
| 页面 hidden 暂停 | 代码路径存在 |

## 未测（禁止编造）
| 项 | 状态 |
|---|---|
| Android FPS / Memory / GPU | **未测** |
| iPhone FPS / Memory | **未测** |
| Android 连续试玩真机录屏 | **未提供** |
| iPhone 连续试玩真机录屏 | **未提供** |
| 首屏 / TTI | **未测** |
| 空闲/Spin/BigWin/FS FPS | **未测** |
| 10 分钟内存 | **未测** |

## 浏览器证据（非真机）
- `video/` 下 Playwright webm：Buffalo 动作 / Big Win 演示
- 标注：**Browser capture only — not Android/iPhone**

## Phase 2 性能相关落地
- buffalo.webp 512 旁路资产
- Atlas 建议文档（未切管线）
- 大奖粒子预算上调（仍受 quality LOD 限制）

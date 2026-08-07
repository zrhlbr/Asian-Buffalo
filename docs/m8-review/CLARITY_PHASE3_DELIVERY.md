# M8 Phase 3 — 画面清晰度提升交付

**未 Commit / Merge / Push / PR — 停笔待复审**

## 本轮改动摘要
1. Symbol runtime plate **512 → 1024**（消除最大模糊源）  
2. Mipmap + Anisotropy(≤16) + high-quality imageSmoothing  
3. DPR：high≤3，medium/low≤2（low 不再 DPR=1）  
4. Renderer 始终 MSAA；DOF 关闭；Bloom 收紧  
5. 天空/地面细分提升；HUD font-smoothing  

## 报告
- `RENDERER_CONFIG.md`
- `TEXTURE_CONFIG.md`
- `PERF_CLARITY_IMPACT.md`
- 对比截图：`screenshots/p3-clarity-*`

## 真机
| 项 | 状态 |
|---|---|
| Android 原图 | **未测 / 未提供** |
| iPhone 原图 | **未测 / 未提供** |
| 浏览器 PC / 手机 / 平板 | 见 screenshots |

## Patch / SHA
- Patch：`AB-K1-R1-M8-clarity.patch`
- **SHA-256：** `6cf73f81879d2e0d2d1e82dc5c15723578b50fe5f98b189fb60fc5e24e80f4b2`
- 字节/行：见该 patch 文件（约 160KB / 1954 行）
- 另含未跟踪测试：`tests/r1-m8-clarity.test.mjs`

## 运行时探针（浏览器）
| 视口 | DPR | Canvas 缓冲 |
|---|---|---|
| Phone 844×390 | 3 | **2532×1170** |
| PC 1280×720 | 2 | **2560×1440** |
| Tablet 1024×768 | 2 | **2048×1536** |

证据：`perf/clarity-probe.json`

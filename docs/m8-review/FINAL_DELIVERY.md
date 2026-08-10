# Asian Buffalo R1-M8 持续完善 — Review 交付（禁止 Commit/Push/PR）

## ① Review Patch
- 路径：`docs/m8-review/AB-K1-R1-M8-review.patch`
- **SHA-256:** `69608f82ce7c5e6d02dc67285afe2ebc8143a388abb84a92c100410325b596c2`
- **字节数:** 306328
- **行数:** 3916
- **diff 文件数（tracked）:** 17

## ② 修改清单（本轮重点）
- `client/m5/game/reels.ts` — 贴边 scale、减薄金属、玻璃/遮罩、`measureScreenFill`
- `client/m5/scene/world.ts` — `applyCommercialFov`、相机贴边
- `client/m5/boot.ts` — safe-area pad、迭代收敛、edge 调试态
- `client/m5/styles.css` — 横屏 HUD/console、Spin 焦点
- `client/m5/game/symbols.ts` — `?url`、buffalo 裁剪、统一 rim
- `client/m5/ui/hud.ts` / `app/game-client.tsx` — Currency + Session pill
- `client/m5/formal-provider.ts` / `adapter.ts` / `game.ts` / `mock-provider.ts` — getCurrency
- `tests/r1-m8-commercial.test.mjs` — 贴边/FOV 断言
- `docs/m8-review/*` — 报告与截图

完整 porcelain：`FILE_LIST.txt`

## ③ 报告
| # | 文件 |
|---|---|
| Mechanical Polish | `MECHANICAL_POLISH_REPORT.md` |
| Symbol 审核 | `SYMBOL_AUDIT.md` |
| 性能 | `PERF_REPORT.md` |
| 安全 | `SECURITY_REPORT.md` |
| 风险 | `RISK_REPORT.md` |
| 回滚 | `ROLLBACK.md` |
| 商业分 | `COMMERCIAL_SCORE.md` |

## ④ 截图 / 视频
- PC：`screenshots/01-pc-idle.png` … `03-pc-celebration.png`
- 手机横屏：`04-phone-landscape-idle.png`, `05-phone-landscape-spin.png`
- 平板：`06-tablet-idle.png`
- 竖屏：`07-phone-portrait.png`
- Reel 贴边特写：`edge-844x390-*.png`, `edge-915x412-*.png`
- HUD 特写：`*-hud-top.png`, `*-hud-bottom.png`
- Big Win：`08-phone-bigwin.png` + `video/` 下 Playwright webm
- 真机完整试玩视频：**未提供（未测）**

## ⑤ 验收结论
- **工程：** 正式链路未破；M8 单测 + identity hosting null PASS  
- **商业：** 横屏贴边实测达标；整体商业分 **83.7/100**  
- **最终验收：不申请**（buffalo 源资产仍非正式 Symbol + 真机性能未测 + 未达 ≥90）

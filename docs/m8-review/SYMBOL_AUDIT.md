# Symbol 审核报告 — M8 商业级 3D 全面升级

**日期：** 2026-08-07  
**风格目标：** 商业级 3D 立体 / HDR / 黑金统一边框 / 紫金环境光 / 上左主光  

## 资源规格（每 Symbol）
| 规格 | 路径模式 |
|---|---|
| 2048 PNG | `docs/m8-review/symbols/{id}-2048.png`（由 1024 master 上采样） |
| 1024 PNG | `docs/m8-review/symbols/{id}-1024.png` + `client/m5/assets/symbols/{id}.png` |
| 512 WebP | `docs/m8-review/symbols/{id}-512.webp` + `client/m5/assets/symbols/{id}.webp` |
| Atlas | `docs/m8-review/symbols/symbols-atlas-512.webp`（4×4 / tile 512） |
| Manifest | `docs/m8-review/symbols/manifest.json` |

## 逐项审核

| SymbolId | 3D立体 | HDR/统一光 | 边框 | 文字/Logo | 亚洲主题 | 判定 |
|---|---|---|---|---|---|---|
| **buffalo** | ★★★★★ | ★★★★★ | 黑金 | 无 | 亚洲水牛弯角 | **PASS — 核心王牌** |
| wild | ★★★★★ | ★★★★☆ | 黑金浮雕 | WILD 本体 | 金属传奇 | **PASS** |
| scatter | ★★★★☆ | ★★★★☆ | 黑金 | SCATTER 牌 | 太阳/神庙图腾 | **PASS** |
| elephant | ★★★★★ | ★★★★☆ | 黑金 | 无 | 亚洲象 | **PASS** |
| lion | ★★★★★ | ★★★★☆ | 黑金 | 无 | 亚洲虎（math id=lion） | **PASS** |
| zebra | ★★★★☆ | ★★★★☆ | 黑金 | 无 | 写实斑马 | **PASS** |
| antelope | ★★★★☆ | ★★★★☆ | 黑金 | 无 | 亚洲鹿/羚 | **PASS** |
| a | ★★★★☆ | ★★★★☆ | 黑金 | 字母 A | 宝石浮雕 | **PASS** |
| k | ★★★★☆ | ★★★★☆ | 黑金 | 字母 K | 宝石浮雕 | **PASS** |
| q | ★★★★☆ | ★★★★☆ | 黑金 | 字母 Q | 宝石浮雕 | **PASS** |
| j | ★★★★☆ | ★★★★☆ | 黑金 | 字母 J | 宝石浮雕 | **PASS** |
| ten | ★★★★☆ | ★★★★☆ | 黑金 | 数字 10 | 宝石浮雕 | **PASS** |
| nine | ★★★★☆ | ★★★★☆ | 黑金 | 数字 9 | 宝石浮雕 | **PASS** |

## 运行时统一
`client/m5/game/symbols.ts`：
- 轻量底板（不二次厚绘 jewel 抢戏）
- 统一暖金 + 微量紫环境 wash
- 底部 AO 厚度感
- 外圈黑金 specular rim

## 备注 / 风险
1. Master 生成分辨率为 **1024²**；2048 为高质量上采样，非原生 2K 渲染。若要原生 2048，需外包/DCC 重渲。  
2. Atlas 已产出建议包；引擎侧仍走单贴 PNG（未改打包契约）。  
3. MipMap：浏览器/`THREE.LinearMipmapLinearFilter` 默认可用；未新增 KTX2 管线。  

## 结论
全套已替换为商业向 3D 立体资产；**Buffalo 为最高辨识度核心**。  
仍建议赵总目视 Reel 真机后再定最终验收。

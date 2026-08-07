# M8 Symbol 商业级 3D 升级交付

**未 Commit / Merge / Push / PR**

## 完成内容
1. **全套 13 Symbol** 重新制作为商业向 3D 立体资产（Buffalo 最高优先级）  
2. 每 Symbol 输出：2048 PNG / 1024 PNG / 512 WebP  
3. **Texture Atlas**（512 WebP + PNG）+ `manifest.json`  
4. 运行时接入：`client/m5/assets/symbols/*.png`  
5. 运行时统一：轻 wash + AO 厚度 + 黑金 rim（不盖死已有 3D 框）  
6. 审核表：`SYMBOL_AUDIT.md`

## 关键路径
| 用途 | 路径 |
|---|---|
| 游戏运行时 | `client/m5/assets/symbols/{id}.png` |
| 交付母版包 | `docs/m8-review/symbols/` |
| Atlas | `docs/m8-review/symbols/symbols-atlas-512.webp` |
| 手机截图 | `docs/m8-review/screenshots/p3-symbols-phone-*.png` |

## 测试
`tests/r1-m8-commercial.test.mjs` — 7/7 PASS（含全套资产存在性）

## 诚实说明
- Master 原生 **1024²**；2048 为上采样（非 DCC 原生 2K）  
- Atlas 已产出，引擎仍单贴加载（避免改构建契约）  
- 最终验收仍需赵总 / 真机目视确认 Buffalo「最值钱」观感  

## 商业 Symbol 维度自评
**Symbol 统一 / 冲击力：约 90–92（视觉）** — 整体商业分是否 ≥90 仍取决于真机与其它维度。

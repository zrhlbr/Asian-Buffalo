# Texture Atlas / MipMap / 压缩建议

## 已产出
- `symbols-atlas-512.webp` — 4×4 grid，tile=512，顺序见 `manifest.json`
- `symbols-atlas-512.png` — 同源 PNG
- 每 Symbol 旁路：`{id}-512.webp`（运行时可选）

## 建议接入（下轮，未改本轮构建契约）
```
UV = (col / 4, row / 4) … (col+1)/4, (row+1)/4
order = buffalo, wild, scatter, elephant, lion, zebra, antelope, a, k, q, j, ten, nine
```

1. High：单贴 1024 PNG（当前）  
2. Medium/Low：Atlas 512 WebP + Shared `CanvasTexture` 或 `Texture`  
3. MipMap：`texture.generateMipmaps = true`；`minFilter = LinearMipmapLinearFilter`  
4. 压缩：WebP 88；后续可加 Basis/KTX2（需构建链）  

**本轮：** 资产与 Atlas 文件齐备；客户端仍 preload 单 PNG，保证安全回退。

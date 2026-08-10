# Texture 配置说明 — M8 Phase 3 Clarity

## Symbol 运行时
| 项 | 配置 |
|---|---|
| 源资产 | `client/m5/assets/symbols/*.png` **1024²** |
| Canvas plate | **SIZE = 1024**（Phase3 前为 512，会强制降采样） |
| colorSpace | `SRGBColorSpace` |
| generateMipmaps | **true** |
| minFilter | `LinearMipmapLinearFilter` |
| magFilter | `LinearFilter` |
| anisotropy | `min(16, GPU max)` via `setSymbolMaxAnisotropy` |
| 2D draw | `imageSmoothingQuality = "high"` |
| 统一后处理 | 轻 wash + 底部 AO + 黑金 rim（不二次压糊） |

## 交付规格（已有）
- 2048 PNG（上采样母版） / 1024 PNG / 512 WebP  
- Atlas：`symbols-atlas-512.webp`（低画质可选；**不替代** 1024 运行时）

## LOD 原则
降低画质时只砍：阴影尺寸、粒子、草、Bloom、GodRays。  
**禁止**降低 Symbol plate 分辨率或 anisotropy 到不可读。

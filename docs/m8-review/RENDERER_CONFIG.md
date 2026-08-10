# Renderer 配置说明 — M8 Phase 3 Clarity

## WebGLRenderer
| 项 | 配置 |
|---|---|
| antialias | **always true**（含 low） |
| powerPreference | `high-performance` |
| setPixelRatio | `min(devicePixelRatio, profile.cap)` via `clarityPixelRatio()` |
| High cap | **3** |
| Medium / Low cap | **2**（禁止为性能把 DPR 打到 1） |
| setSize | CSS 尺寸由 `#gl` 控制；drawing buffer 跟 DPR |
| toneMapping | `ACESFilmicToneMapping` |
| exposure | 1.05（FreeSpin 1.10） |
| outputColorSpace | `SRGBColorSpace` |
| shadowMap | PCFSoft；low 可关阴影但仍保 DPR |

## Post
| 项 | 配置 |
|---|---|
| Bloom | 开时 strength≈0.28（收紧，减少 Symbol 边缘发糊） |
| GodRays | high only |
| DOF / Bokeh | **默认关闭**（避免 Reel 景深发虚） |
| OutputPass | 保留 |

## MSAA
依赖浏览器 WebGL `antialias: true`（多重采样）。未叠 FXAA，以免二次软化。

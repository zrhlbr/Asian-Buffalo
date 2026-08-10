# 性能影响报告 — Phase 3 Clarity

## 预期影响（定性；真机 FPS **未测**）
| 变化 | 影响 |
|---|---|
| Symbol canvas 1024² ×13 | VRAM↑（约数倍于 512）；换清晰度 |
| DPR low/medium ≥2 | 填充率↑；手机更锐 |
| High DPR cap 3 | 旗舰机更锐，功耗↑ |
| MSAA always on | GPU↑；边缘更干净 |
| DOF off | **略省** post 成本 |
| Bloom 减弱 | 略省 |
| Shadow high 2048 | high 档阴影成本↑ |

## 原则执行情况
- ✅ 中低端优先砍粒子/阴影/草，不砍 Symbol 分辨率  
- ✅ low.pixelRatio = 2  
- ❌ 未提供 Android/iPhone 实测 FPS/内存数字（禁止编造）

## 建议真机验证
1. 连续 Spin 10 分钟内存  
2. 空闲 / Spin / BigWin FPS  
3. high vs medium vs low 主观锐度  

# M8 风险报告

| 风险 | 级别 | 缓解 |
|---|---|---|
| buffalo 标题卡被当 Symbol | High | 运行时裁剪；审核表 FAIL；须换资产 |
| 厚金属轨被视觉误判为留白 | Medium | 已减薄 OUTER_RAIL；继续真机目视 |
| Vite/RSC 缓存导致旧布局截图 | Medium | `--force` / 重启 Vite；以 fill-probe 为准 |
| hosting.json 本地临时改 DB | Low | 交付前恢复 null；有 identity 测试盯梢 |
| 真机 FPS/内存未测 | Medium | 报告标「未测」；不申请最终验收 |
| MockProvider 接口补 getCurrency | Low | 已补；正式路径不导入 Mock |

## 回滚
见 `ROLLBACK.md`：丢弃工作区对 `9654d41` 的未提交改动即可。

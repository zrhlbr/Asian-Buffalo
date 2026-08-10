# M8 安全报告（本轮 polish）

## 冻结边界
- 未改 Session / Spin / Round / FROZEN Math / RTP / Paytable / RNG / Wallet / Ledger / Recovery / Schema / Migration / MoneyService / API 契约

## 正式路径
- `bootM5` 仅 `FormalGameProvider`
- 无 `createDemoGrid` / `evaluateSpin` 上正式壳
- `window.__game` 仅 DEV / 显式 allow；production + 非允许时删除
- TEST Identity 仍需 `AB_ALLOW_TEST_IDENTITY=1`
- `.openai/hosting.json` 交付态 `d1: null`（本地截图时曾临时 `DB`，已恢复）

## Currency / Session pill
- 仅展示钱包返回的 `currency` 与会话就绪样式
- 不写余额、不改 Ledger、不触发 Spin

## 敏感信息
- 未向前端暴露 Token / 密钥
- 未新增敏感日志

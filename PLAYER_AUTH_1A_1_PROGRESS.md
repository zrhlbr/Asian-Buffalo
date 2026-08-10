# PLAYER-AUTH-1A.1 Progress (mid-flight)

**Updated:** 2026-08-11  
**Secrets:** not read / not printed / not copied  

## Confirmed so far

| Check | Result |
|---|---|
| SMS BRIDGE DEPLOYED | **YES**（`100.105.217.7:8791`） |
| HEALTH | **PASS**（configured, skConfigured=true） |
| BRIDGE PRIVATE | **PASS** — listen **only** `100.105.217.7`（Tailscale CGNAT；非 `0.0.0.0`） |
| XI GAME Server → Tailscale → Bridge | **PASS** — `zrh-server` (`100.83.172.96`) `GET /health` → HTTP 200 |
| Unauth send from Bridge host | previously **401**（token required） |
| Production `AB_SMS_BRIDGE_URL/TOKEN` | **MISSING**（prod API 尚未接 Bridge；本轮 Smoke 走授权脚本） |
| SK REAL SMS SMOKE | **AWAITING_OPERATOR** — 本机交互窗口已打开 |

## Operator action required NOW

本机已启动可见窗口运行：

`deploy/sms-bridge/smoke-once.ps1`

请在窗口中：

1. 粘贴 `BRIDGE_SERVICE_TOKEN`（隐藏输入，勿发聊天）  
2. 输入赵总批准的测试手机号（09… / +959…）  
3. 确认 `YES` 发送 **仅 1 条**  
4. 查看真实手机是否收到短信  

然后在 Cursor 回复（不要发完整手机号、不要发 OTP、不要发 Token）：

- `RECEIVED=YES` 或 `RECEIVED=NO`  
- 若已发送：附带 `SK_ACCEPTED=PASS/FAIL`（窗口会显示）

收到 `RECEIVED=YES` 后才会继续 OTP VERIFY → REGISTER → … → LEDGER。  
任何失败：**停止，不伪造 PASS**。

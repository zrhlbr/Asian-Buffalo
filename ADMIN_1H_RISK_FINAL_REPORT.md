# ADMIN_1H_RISK_FINAL_REPORT

## Honest capability（不得伪造 YES）

| Domain | Verdict | Evidence |
|---|---|---|
| LOGIN RISK | **PARTIAL** | `admin-risk.ts` marks authCapability PARTIAL；有事件/工作流，非完整独立 Login Risk 引擎证明 |
| DEVICE/IP RISK | **PARTIAL** | DEVICE/IP categories + MULTI_IP_SWITCH 等信号存在；完整多设备图谱未全量证明 |
| DEPOSIT/WITHDRAW RISK | **PARTIAL** | fail-burst / status anomaly 候选存在；依赖订单数据密度 |

Manual workflow OPEN→REVIEWING→RESOLVED/DISMISSED：**可用**（1E）。  
Money integrity 消费进 Risk：**可用**。  
Auto freeze / balance mutate：**禁止**（保持）。

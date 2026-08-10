# ADMIN_FUNCTION_MATRIX_V2

**Phase:** ADMIN-1A  
**Date:** 2026-08-09  
**Workspace:** `D:\Asian-Buffalo-R1-M9-Cursor-Clean`

Status keys: **IMPLEMENTED** | **PARTIAL** | **MISSING** | **BLOCKED**

---

## A. 运营总览

| Function | UI | API | DB/Agg | Status | Gap |
|----------|----|-----|--------|--------|-----|
| Dashboard shell | Y | Y | Y | PARTIAL | KPI 口径不全 |
| 今日新增 | Y | Y | players | IMPLEMENTED | |
| 总玩家 | Y | Y | players | IMPLEMENTED | |
| 当前在线 | Y | Y | sessions OPEN | IMPLEMENTED | 会话≠登录在线定义需产品确认 |
| 今日登录 | Y | Y | rounds DISTINCT | PARTIAL | 非 login event |
| 今日游戏人数/局数 | Y | Y | rounds | IMPLEMENTED | |
| 今日投注/派彩/净结果 | Y | Y | settled rounds | IMPLEMENTED | |
| 今日充值/提现 count | Y | Y | deposit/withdraw tables | PARTIAL | 缺金额 KPI / pending deposit |
| 待处理提现 | Y | Y | Y | IMPLEMENTED | |
| 待处理充值 | N | N | N | MISSING | 1B |
| 风险事件卡 | PARTIAL | anomalyCount | PARTIAL | PARTIAL | 应用 risk feed |
| 系统告警 | Y | hardcoded ok | PARTIAL | PARTIAL | 真实 probe |
| 24h 趋势 | Y | hourly | Y | IMPLEMENTED | |
| 7日趋势 | Y | trend7d | Y | IMPLEMENTED | |
| 实时运营 / 自动刷新 | Y | poll 10s | Y | PARTIAL | 单请求 OK；无独立 realtime |

## B. 玩家管理

| Function | Status | Notes |
|----------|--------|-------|
| 玩家列表 | PARTIAL | 分页/搜索/状态筛选有 |
| 用户名/UID/VIP/余额相关 | PARTIAL | 有 nickname/VIP/ledger；无统一余额卡 |
| 手机脱敏 | IMPLEMENTED | `phoneMasked` |
| 邮箱 | MISSING | |
| 注册/最后活跃 | PARTIAL | createdAt + lastActive/lastLogin |
| 风险等级列 | PARTIAL | detail riskTags；列表无等级筛选 |
| 在线/离线筛选 | MISSING | |
| 玩家详情 | PARTIAL | sessions/rounds/wallet/ledger/risk |
| 登录历史完整页 | MISSING | auth sidecar 常空 |
| 设备/IP 记录 | PARTIAL | 诚实空态 |
| 冻结/解冻 | IMPLEMENTED | reason+confirm+audit+RBAC |
| 封禁/解封 | PARTIAL | CLOSE/REOPEN；非独立 ban perm |
| Session 强制注销 | PARTIAL | Sessions 模块；perm=`system:manage` |
| 备注 | MISSING | |
| 后台操作记录（按玩家） | MISSING | 需 audit 按 target 过滤增强 |

## C. 游戏管理

| Function | Status | Notes |
|----------|--------|-------|
| 游戏列表 | PARTIAL | 牛魔王常量 + 今日指标 |
| 游戏开关 | MISSING | RO only phase |
| 游戏版本 | PARTIAL | UI 显示 Not Configured |
| 在线人数 | IMPLEMENTED | onlineSessions |
| 牛魔王详情 RO | PARTIAL | ops + Math 分离 |
| RTP/Math/Paytable 修改 | BLOCKED | 禁止本阶段 |
| Math 只读查看 | IMPLEMENTED | |

## D. Round / Spin

| Function | Status | Notes |
|----------|--------|-------|
| 列表查询 | IMPLEMENTED | search/player/session/status |
| Spin=Round 别名 | IMPLEMENTED | 产品命名 |
| 详情 Bet/Win/Result | IMPLEMENTED | |
| Balance Before/After | PARTIAL | After 存库；Before 推导 |
| Ledger Reference | IMPLEMENTED | ledgerTx on detail |
| 时间范围筛选完善 | PARTIAL | |

## E. 钱包中心

| Function | Status | Notes |
|----------|--------|-------|
| Intent / ProviderOps | IMPLEMENTED | |
| Ledger 全套 RO | IMPLEMENTED | |
| Available/Frozen 语义 | PARTIAL | player detail 可见 ledger kind；commerce `frozenMinor` 未接入 Wallet 模块 UI |
| 充值订单 | PARTIAL | |
| 提现订单+审核+打款标记 | PARTIAL | |
| 调账 | BLOCKED | FUTURE / 最高风险阶段 |
| Provider Gate | BLOCKED | PROVIDER_NOT_CONFIGURED |

## F. 风控中心

| Function | Status | Notes |
|----------|--------|-------|
| 信号查看/筛选 | PARTIAL | 即时计算，无持久化 |
| 多账号/同设备 | MISSING / UNAVAILABLE honest | |
| 异常登录/IP/设备 | PARTIAL | 数据源不足 |
| 高频 Spin | IMPLEMENTED | HIGH_FREQ_SPIN |
| 处置/备注/状态机 | MISSING | |
| risk.manage | MISSING | |

## G. 活动 / VIP / 内容

| Function | Status | Notes |
|----------|--------|-------|
| 活动列表/upsert | PARTIAL | |
| 每日签到归属 Activity | PARTIAL | 服务层有 checkin；Admin UX 需复核 |
| VIP 等级/玩家 VIP | PARTIAL | manage 存在；1F 以只读为主 |
| 公告三语 | PARTIAL | PUBLISHED 强制三语 |
| Banner | MISSING | |
| 推荐游戏内容 | MISSING | |

## H. 客服

| Function | Status | Notes |
|----------|--------|-------|
| 渠道配置 | PARTIAL | support_info |
| 工单系统 | MISSING | OPEN/PROCESSING/RESOLVED/CLOSED |
| 内部备注 | MISSING | |
| 玩家查询快捷入口 | PARTIAL | 可跳 Players |

## I. 审计 / 系统 / Admin 用户

| Function | Status | Notes |
|----------|--------|-------|
| Admin Action Log | PARTIAL | |
| Security / Wallet / Risk 专用日志 | MISSING | 混在 detail_json |
| Admin 用户 CRUD-ish | IMPLEMENTED | |
| Role matrix UI | IMPLEMENTED | |
| System health | PARTIAL | |
| Environment/Version | PARTIAL | status.version |

## J. Cross-cutting

| Function | Status |
|----------|--------|
| Pagination | IMPLEMENTED on lists |
| Search debounce | PARTIAL / MISSING（多为即时 setState 重载） |
| Responsive tables | PARTIAL（需 1H 验收） |
| i18n zh/en/my Admin UI | IMPLEMENTED |
| Isolation ZRHPay | IMPLEMENTED policy |
| Fake data ban | HELD |

---

## Summary counts (approx.)

| Status | Count (primary rows) |
|--------|----------------------|
| IMPLEMENTED | ~25 |
| PARTIAL | ~45 |
| MISSING | ~18 |
| BLOCKED | ~5 |

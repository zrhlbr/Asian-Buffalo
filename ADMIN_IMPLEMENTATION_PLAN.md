# ADMIN_IMPLEMENTATION_PLAN

**Phase freeze:** ADMIN-1A complete → await 赵总批准后进入 ADMIN-1B  
**Principle:** 不推倒 M9；增量补缺口；每阶段完成→测试→报告→停笔  
**Hard gates:** Isolation · Money CLOSED · No fake data · No Push/Merge/Rebase without approve · No Math/RNG write

**Workspace:** `D:\Asian-Buffalo-R1-M9-Cursor-Clean`

---

## IA freeze (target nav groups)

1. **运营总览** — Dashboard / 实时运营 / 今日数据 / 系统状态  
2. **玩家管理** — 列表·详情·资料·登录·Session·设备·IP·风险·封禁·备注  
3. **游戏管理** — 列表·牛魔王·状态·开关(未来)·版本·在线·局记录·配置 RO  
4. **订单/局记录** — Round/Spin/Bet/Win/Result 追踪  
5. **钱包中心** — Balance/Available/Frozen · Ledger · 充提 · 调账(BLOCKED)  
6. **风控中心** — 事件·等级·处置  
7. **活动运营** — 活动·VIP·奖励（签到属此）  
8. **客服中心** — 工单  
9. **内容管理** — Banner·公告·三语  
10. **审计中心** — Login/Action/Security/Wallet/Risk logs  
11. **系统中心** — Admins·Role·Permission·Health·Version·Env  

Current M9 nav already covers most groups; 1B–1I **reshape/complete**, not rewrite.

---

## Phase ADMIN-1A — Status Audit + IA + RBAC freeze  
**Status:** DONE (this delivery)  
**Exit:** 7 docs + verdict · no business code · stop for approve

---

## Phase ADMIN-1B — Dashboard + Players

**Goals**
- Dashboard KPI 对齐：待处理充值、风险事件卡、诚实系统探针（禁止假绿）
- 今日登录口径：有 auth 数据用 auth；否则显示 `NOT AVAILABLE`（禁止用局数冒充并隐瞒）
- Players：搜索增强（手机）、风险/在线筛选（能做则做）、备注表（若加 DB sidecar）、CLOSE 与 FREEZE 权限语义澄清
- Session revoke 权限 remap 评估（additive `players:session:revoke`）
- 保持空态诚实；分页；不造假

**Out of scope:** Wallet adjust · Risk workflow · Content Banner · CS tickets · Money open

**Exit criteria**
- Dashboard/Players 验收清单勾选  
- 单测/本地 smoke  
- 报告停笔

---

## Phase ADMIN-1C — Games + Round/Spin

**Goals**
- Games：版本字段接 Math 当前激活版本（RO）
- 牛魔王详情：Math 版本 / RTP 配置 RO / 异常 Round 入口
- Round/Spin：时间筛选、Game ID（单游戏常量）、Ledger 互链 UX 强化
- 禁止 Math/RTP/RNG 写

**Exit:** RO 运营观测完整 · 报告停笔

---

## Phase ADMIN-1D — Wallet + Ledger

**Goals**
- Wallet Center UI：Balance / Available / Frozen 明确展示
- 充提列表筛选/分页 UX 完善
- Gate banner：`PROVIDER_NOT_CONFIGURED` / GATE CLOSED 诚实展示
- **不**实现人工调账；标记 BLOCKED
- Ledger ↔ Round 深链

**Exit:** 资金只读运营可用 · Money still CLOSED · 报告停笔

---

## Phase ADMIN-1E — Risk + Audit

**Goals**
- Risk Center：持久化事件（或 sidecar）+ 备注 + PROCESSING/RESOLVED + audit
- 信号覆盖对照清单；设备多账号继续诚实 UNAVAILABLE 直至数据源
- Audit：Before/After/RequestId（additive columns）· 分类视图
- `risk:manage` permission additive

**Exit:** 可处置可追溯 · 报告停笔

---

## Phase ADMIN-1F — Content + Activity + VIP

**Goals**
- Banner CMS + 公告三语并列校验（发布前强制）
- Activity Center（签到不回流大厅 Banner）
- VIP：等级/玩家/升级记录 — **只读优先**；避免改玩家端核心算法
- CONTENT role + content.* perms（additive）

**Exit:** 三语发布不混语言 · 报告停笔

---

## Phase ADMIN-1G — Customer Service + Admin Users

**Goals**
- 工单：OPEN/PROCESSING/RESOLVED/CLOSED · 内部备注不外泄
- Admin Users 体验与角色文档对齐（CONTENT / SUPPORT 命名）
- support.* perms

**Exit:** 客服可运营 · 报告停笔

---

## Phase ADMIN-1H — Responsive + Security + Performance

**Goals**
- Breakpoints: 1920 / 1440 / 1366 / 1024 / 768 / 390
- 表格卡片化/横向滚动；禁整页崩坏
- Login rate limit · debounce · dashboard 聚合缓存/合并请求
- 视觉：专业深色 + 品牌蓝紫；去赌场花哨
- Secret hygiene（勿提交 `.dev.vars`）

**Exit:** 安全/性能/响应式验收 · 报告停笔

---

## Phase ADMIN-1I — Full Admin Regression

**Goals**
- 全模块回归矩阵  
- Isolation 复核  
- Money gate 仍 CLOSED  
- Production **只读 smoke**（写操作需另批）  
- 交付总裁决；仍不擅自 Deploy/Push

**Exit:** FINAL ADMIN-1 verdict · stop

---

## Cross-phase rules

| Rule | Apply |
|------|-------|
| 每阶段只做本阶段 | YES |
| 测试 + 报告 + 停笔 | YES |
| Fake data | FORBIDDEN |
| Production 危险写测 | FORBIDDEN |
| ZRHPay 接入 | FORBIDDEN |
| 推倒重写 Admin | FORBIDDEN |
| Adjust / open money | 需单独安全阶段批准 |

---

## Suggested 1B first commits (after approve only)

1. Dashboard KPI honesty + pending deposits + probe honesty  
2. Players search/filter/notes (if schema) + permission additive for revoke  
3. Tests update `tests/r1-m7-admin.test.mjs`  
4. `ADMIN_PHASE1B_*` reports  

No commits in 1A.

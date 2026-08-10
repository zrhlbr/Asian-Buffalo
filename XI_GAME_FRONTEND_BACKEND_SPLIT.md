# 《西游戏》前台 / 后台开发正式拆分

**生效日期：** 2026-08-08  
**决策人：** 赵总  
**状态：** 正式执行（等待验收确认）  
**关联制度：** `docs/04-开发指挥与交付制度.md`、《开发规则》、产品隔离（西游戏 ≠ ZRHPay）

---

## 0. 一句话

从现在起，**《西游戏》玩家前台**与**《西游戏》管理后台**为两条独立开发线。  
**不得再混合开发。** 未经批准的跨线修改必须**停笔报告**。

最高原则永久执行：

> 【修改一个模块，绝不能影响其它无关模块】

---

## 1. 工作区与职责

| 开发线 | 工作区 | 代号 |
|--------|--------|------|
| 前台 / 玩家端 / 游戏端 | `D:\Asian-Buffalo-R1-M8-Cursor-Clean` | **M8** |
| 后台管理系统 | `D:\Asian-Buffalo-R1-M9-Cursor-Clean` | **M9** |

### 1.1 M8 职责（仅前台）

- 西游戏大厅（Lobby）
- 牛魔王 Hub
- 牛魔王 Play
- Wallet Center（玩家侧）
- Player Center
- Activity Center（玩家侧）
- VIP 前台
- 客服前台
- 登录 / 注册前台
- 三语（玩家端）
- Mobile / 响应式玩家体验
- WebGL / 游戏视觉 / 动物动画 / Reel
- 游戏性能与体验

### 1.2 M8 严禁修改

- `/admin` 及任何 Admin UI
- Admin API（`/api/admin/*`）
- Admin RBAC / Admin Session / `admin_*` 表逻辑
- Admin Dashboard 及全部 Admin 业务页面
- 为后台需求改写 Admin 模块

### 1.3 M9 职责（仅后台）

- `/admin/login`、`/admin`
- Dashboard
- Players / Sessions / Rounds / Spins
- Wallet / Ledger / Deposit / Withdrawal（Admin 侧，只读或经正式 Service）
- Games / 牛魔王运营页
- VIP Admin / Activity Admin
- Announcement / Ranking / Customer Service Admin
- Admin Users / RBAC / Audit Log
- Risk / System Health
- Admin 三语与后台响应式

### 1.4 M9 严禁修改

- Lobby / Hub / Play
- Reel / Spin 表现层
- Animal Animation / WebGL / 场景与特效
- Math / RTP / RNG / Paytable 核心
- 玩家前台视觉与性能专项

---

## 2. 代码边界

| 线 | 拥有范围 |
|----|----------|
| **M8** | 只拥有玩家端 / 游戏端代码 |
| **M9** | 只拥有管理后台代码 |

### 2.1 共享 API Contract（允许）

若存在共同业务后端 API（例如玩家游戏 API、钱包查询 Contract）：

- **允许**：两边按已发布 **API Contract** 调用
- **禁止**：为后台需求直接修改游戏核心数学 / RNG / RTP
- **禁止**：为前台视觉需求改写 Admin RBAC / Audit / 资金审核逻辑

### 2.2 跨模块 / 跨线修改门禁

任何跨线或跨无关模块修改，**必须先书面说明**：

1. **为什么必须改**（必要依赖，而非方便）
2. **影响范围**（文件 / API / 表 / 会话）
3. **回归风险**（前台 / 后台 / 资金 / 数学）

**未经赵总批准：不得跨线修改。**  
发现误入对方职责范围：**立即停笔并报告**。

---

## 3. 数据库边界

- 前台与后台可以**读取**同一个「西游戏业务数据库」。
- 后台写操作必须经正式 **Service / Repository / API** 层。
- **严禁**：后台页面直接操作数据库（绕过服务层）。
- **严禁**：Admin 直接 `UPDATE` 余额。
- 资金变更必须统一经过：

  1. Wallet Service  
  2. Ledger  
  3. Audit Log  

- Production 资金门禁未批准前：**GATE CLOSED**，不得为演示打开真实资金。

---

## 4. Git 边界

- 前台（M8）与后台（M9）分别维护**独立工作区 / 独立分支**。
- **禁止**：M8 改动混入 M9 Patch。
- **禁止**：M9 改动混入 M8 Patch。
- **禁止**：`git add -A` / `git add ./` 误收对方或无关文件（精确 add）。

### 每次交付必须提供

1. `git status`
2. 修改文件清单（仅本线）
3. Review Patch（仅本线）
4. SHA-256（本线交付物）

未经赵总批准：**禁止 Commit / Push / Merge / Rebase / Deploy**。

---

## 5. Deployment 边界

Production 最终可组成同一产品站点：

| URL | 产品面 | 开发归属 |
|-----|--------|----------|
| `https://www.xibull.com` | 玩家前台 | **M8** |
| `https://www.xibull.com/admin` | 西游戏后台 | **M9** |

- 开发阶段必须**分线**；合并发布须单独批准。
- 部署后台不得顺带改前台视觉；部署前台不得顺带改 Admin。
- 与 ZRHPay 继续彻底隔离（域名 / Session / Admin / DB / SDK 不共享）。

---

## 6. Regression 规则

| 规则 | 说明 |
|------|------|
| 模块隔离 | 改 A 不得破坏无关 B |
| 前台回归 | M8 变更：大厅 / Hub / Play / 钱包前台 / 三语 / Mobile / WebGL 冒烟 |
| 后台回归 | M9 变更：Login / RBAC / Dashboard / 关键读写模块 / Audit；API 403/401 |
| 资金回归 | 任何资金相关：Ledger 平衡、禁止直改余额、Money Gate 仍关闭 |
| 数学回归 | Math / RTP / RNG **默认不可改**；若例外须单独批准与专用回归 |
| P0 失败即停 | Admin 500、越权、玩家进 Admin、余额直改、Ledger 不一致、Secret 泄露、资金误开 |

---

## 7. 任务分发规则（当前）

| 任务类型 | 发给 |
|----------|------|
| 前台视觉 / Lobby / Hub / Play / WebGL / 性能 | **仅 M8** |
| Admin / RBAC / Audit / 后台运营页 | **仅 M9** |
| 共享 API Contract 变更 | 先说明边界 → 赵总批准 → 指定工作区执行 |

**当前任务：**

- **M8**：保持当前 Production 前台基线；不承接后台开发。
- **M9**：单独继续完善《西游戏后台管理系统》；不承接前台视觉任务。

---

## 8. 与 ZRHPay 隔离（重申）

本拆分仅针对《西游戏》前台 vs 后台。  
《西游戏》与《ZRHPay》仍为**完全独立产品**，禁止共品牌 / 共后台 / 共库 / 共 Session / 共 SDK。

---

## 9. 本文件交付状态

| 项 | 状态 |
|----|------|
| 文档落盘（M9） | `XI_GAME_FRONTEND_BACKEND_SPLIT.md` |
| Commit | **未执行** |
| Push / Merge / Rebase / Deploy | **未执行** |

**等待赵总验收。**

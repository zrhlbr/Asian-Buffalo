# AB-K1-SERVER-LEDGER 交付报告

批次编号：`AB-K1-SERVER-LEDGER`
负责人：Kimi Code
状态：已完成，等待 ChatGPT/Codex 审查

## 一、Git 基线与提交

- 起始基线：`0014bab9aa78b99da4f2c46a69a8c115b350ea1b`
- 功能分支：`feature/ab-k1-server-ledger`
- 最终提交：`eb9bbed6cc6b0fa8c6ee88a53c4645838a6aa7db`
- 父提交：`dac2ce567a7abae66e1a4a792ff3a45960d46ba5`

## 二、本批目标

建立服务端权威开奖与可审计账本核心，不接生产钱包、不开放真实资金。

## 三、新增/修改文件清单

### 核心实现
- `lib/math-config.ts`：版本化数学配置、SHA-256 哈希、DRAFT/FROZEN/RETIRED 状态、真钱启用门控
- `lib/server-game-engine.ts`：服务端 CSPRNG 权威开奖引擎
- `lib/wallet-adapter.ts`：钱包适配器接口与内存测试实现（乐观锁、幂等、非负余额）
- `lib/round-service.ts`：Spin 流程编排（校验→扣款→开奖→派彩→写库）
- `lib/round-store.ts`：局结果存储接口与内存测试实现
- `lib/api-handlers.ts`：API 业务逻辑，统一错误结构
- `lib/db-game.ts`：D1 持久化辅助函数（session、round、math version）

### API 路由
- `app/api/v1/game/sessions/route.ts`
- `app/api/v1/game/spins/route.ts`
- `app/api/v1/game/rounds/[roundId]/route.ts`
- `app/api/v1/game/rules/[mathVersion]/route.ts`

### 修改现有文件
- `lib/game-config.ts`：GAME_VERSION 从 `afb-prototype-0.1.0` 改为 `asb-prototype-0.1.0`
- `lib/game-engine.ts`：补充 `.ts` 扩展名以支持 Node ESM 直接加载
- `db/index.ts`：改为异步动态导入 `cloudflare:workers`，避免构建产物在非 Worker 环境加载失败
- `db/schema.ts`：新增 `game_rounds.request_payload` 字段用于审计回放
- `.gitignore`：忽略 `docs/Asian-Buffalo-Source-v3.zip`
- `package.json` / `package-lock.json`：新增 `better-sqlite3` devDependency

### 迁移
- `drizzle/0001_steady_annihilus.sql`：ALTER TABLE `game_rounds` ADD `request_payload` text
- `drizzle/meta/0001_snapshot.json`
- `drizzle/meta/_journal.json`

### 测试
- `tests/math-config.test.mjs`
- `tests/server-game-engine.test.mjs`
- `tests/wallet-adapter.test.mjs`
- `tests/round-service.test.mjs`
- `tests/api-handlers.test.mjs`
- `tests/migration.test.mjs`
- `tests/db-helper.mjs`

## 四、数据库迁移

### 全新空库
```bash
sqlite3 :memory: < drizzle/0000_early_power_pack.sql
sqlite3 :memory: < drizzle/0001_steady_annihilus.sql
```
验证通过：8 张核心表全部创建，约束与索引正确。

### 已有基线库
```bash
# 已应用 0000 的库
sqlite3 existing.db < drizzle/0001_steady_annihilus.sql
```
验证通过：新增 `request_payload` 列，现有数据保留，`CHECK` 约束生效。

## 五、API 清单与示例

### 1. 创建会话
```http
POST /v1/game/sessions
Content-Type: application/json

{
  "playerId": "player_001",
  "currency": "MMK",
  "mathVersionId": "ab-math-1.0.0"
}
```
响应：
```json
{
  "sessionId": "sess_abc123",
  "mathVersionId": "ab-math-1.0.0",
  "expiresAt": "2026-08-06T07:01:31.000Z"
}
```

### 2. 执行 Spin
```http
POST /v1/game/spins
Content-Type: application/json

{
  "sessionId": "sess_abc123",
  "playerId": "player_001",
  "currency": "MMK",
  "roomBase": 50,
  "betLevel": 1,
  "betMultiplier": 1,
  "idempotencyKey": "spin-20260806-001",
  "isFreeGame": false,
  "freeGamesRemainingBefore": 0
}
```
响应关键字段：
```json
{
  "roundId": "sess_abc123:spin-20260806-001",
  "mathVersion": "ab-math-1.0.0",
  "totalBetMinor": 50,
  "totalWinMinor": 0,
  "balanceAfterMinor": 9950,
  "grid": [[...], ...],
  "lineWins": [],
  "scatterCount": 0,
  "awardedFreeGames": 0,
  "isFreeGame": false
}
```

### 3. 查询局结果
```http
GET /v1/game/rounds/sess_abc123:spin-20260806-001
```

### 4. 查询数学规则
```http
GET /v1/game/rules/ab-math-1.0.0
```

## 六、账本样例

一次普通下注 50 MMK、派彩 120 MMK 的复式分录：

| 账户 | 借贷方向 | 金额（minor） | Memo |
|---|---:|---|---|
| PLAYER_AVAILABLE | 借 | -50 | BET |
| GAME_CLEARING | 贷 | +50 | BET |
| GAME_CLEARING | 借 | -120 | PAYOUT |
| PLAYER_AVAILABLE | 贷 | +120 | PAYOUT |

合计：0。

免费游戏只产生派彩分录，无 BET 分录。

## 七、测试证据

```bash
npm run lint   # 通过，0 errors
npm test       # 通过
```

测试结果摘要：
- 总测试数：59
- 通过：59
- 失败：0

覆盖范围：
- 每个普通符号 2/3/4/5 连线边界
- WILD 替代与禁止替代 SCATTER
- SCATTER 赔付、基础免费局、免费局追加
- WILD 只出现在第 2、3、4 轴
- 50/500 房间与全部投注档位
- 重复幂等请求不重复扣款
- 两个并发 Spin 不能透支余额
- 免费局不扣款
- 借贷总额严格为 0
- 非法客户端结果字段被拒绝
- 数学配置哈希稳定
- 真钱门控：INITIAL_MATH_VERSION 必定被阻止
- 迁移在空库与基线库均通过

## 八、静态检查与构建

- `npm run lint`：通过（0 errors）
- `npm run build`：通过，生成 Sites artifact，包含 ESM Worker `default.fetch`
- 产物中未检出账号、密码、Token、生产地址或目标平台素材

## 九、真钱安全边界

- `INITIAL_MATH_VERSION` 状态为 `DRAFT`
- `disclosure.status` 为 `UNCALIBRATED_PROTOTYPE`
- `disclosure.targetRtp` 为 `null`
- `disclosure.realMoneyEnabled` 为 `false`
- `reelWeights` 与 `maxPayout` 均标记为临时/candidate
- `validateRealMoneyAllowed()` 对任一上述条件均抛出 `RealMoneyBlockedError`
- API 路由默认 `allowRealMoney: false`

## 十、已知风险与未完成项

1. **钱包仍为内存测试适配器**：未接入生产钱包或现有内部签名 API，真实资金开关保持关闭。
2. **真钱开关**：当前硬编码 `allowRealMoney: false`，后续需改为按环境配置并二次审计。
3. **事务原子性**：API 路由中 wallet 结算与 D1 round 保存分两步，极端失败场景下需依赖幂等键重放恢复；真正的跨 wallet/D1 原子事务留待生产钱包集成时实现。
4. **审计事件表**：已预留 `audit_events`，但本批未写入每一局审计事件。
5. **会话状态机**：当前仅创建会话，未实现过期关闭、免费局扣减持久化等完整生命周期。
6. **风控与限额**：身份、地区、KYC、年龄、投注限额等校验未实现。
7. **路线警告**：vinext 静态分析对 API 路由显示 `? Unknown`，属于框架已知限制，不影响构建与运行。

## 十一、下一批建议

- `AB-K2`：生产钱包适配层与真实资金开关控制
- `AB-K3`：完整会话生命周期、免费局持久化、审计事件写入
- `AB-K4`：账户、风控、限额与 KYC 校验

## 十二、回滚方案

1. 丢弃功能分支：`git branch -D feature/ab-k1-server-ledger`
2. 回退到基线：`git checkout main && git reset --hard 0014bab9aa78b99da4f2c46a69a8c115b350ea1b`
3. 数据库回滚：`ALTER TABLE game_rounds DROP COLUMN request_payload;` 并删除 `drizzle/0001_*` 文件与 journal 条目。

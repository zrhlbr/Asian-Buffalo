# PLAYER-AUTH-1A.1 — SK AUTH CONTRACT ROOT-CAUSE AUDIT

**Date:** 2026-08-11  
**Mode:** Read-only（未改代码、未重发短信、未读/打印任何 Secret）  
**Smoke result under audit:** `HTTP_STATUS=401` / `ERROR_CODE=UNAUTHORIZED` / `SK_ACCEPTED=FAIL` / `REAL_SMS_RECEIVED=NO`

---

## Executive correction（重要）

本次 Smoke 的 **HTTP 401 + `UNAUTHORIZED` 来自 SMS Bridge 的 Service Token 校验失败**，  
**请求未进入 `sk-adapter.mjs`，因此尚未构成 SK 设备 username/password 认证失败证据。**

| Layer | Evidence |
|---|---|
| Bridge `authorize()` fail | `server.mjs` → HTTP **401** + `errorCode: "UNAUTHORIZED"` |
| SK adapter auth fail | Would surface as Bridge HTTP **502** + `SMS_SEND_FAILED` / timeout / unavailable（**不是** `UNAUTHORIZED`） |
| SK device auth fail (LIVE history) | HTTP **200** body `{"code":1,"reason":"invalid username or password!"}` 或 `access restricted!` |

因此：  
`XI GAME/smoke → Bridge` 网络可达 = PASS  
Bridge 接受本次 Bearer = **FAIL（401）**  
`Bridge → SK` / `SK auth` = **NOT REACHED THIS RUN**

---

## SK AUTH CONTRACT（真实合同）

Source: Skyline MultiWan HTTP DEVELOPMENT SPEC + LIVE discovery  
Path: `POST /goip_post_sms.html`

| Item | Contract |
|---|---|
| Auth transport | **Query parameters** and/or **JSON body** fields `username` + `password` |
| Header auth | **Not** the documented primary contract（非 Bearer） |
| Cookie / Web session | **Not** required for HTTP API send（Web UI login 是另一条路径） |
| Content-Type | `application/json;charset=utf-8` |
| Body | `{ "type":"send-sms", "task_num":1, "tasks":[{ "tid", "to", "sms", "from"? }] }` |
| Success | body `code:200` / `reason:"OK"` / `type:"task-status"` |
| Auth fail (LIVE) | body `code:1` + `invalid username or password!` 或 `access restricted!`（通常仍 HTTP 200） |

Official minimal shape:

```http
POST /goip_post_sms.html?username=<ENV>&password=<ENV>
Content-Type: application/json;charset=utf-8

{"type":"send-sms","task_num":1,"tasks":[{"tid":1223,"to":"<PHONE>","sms":"<TEXT>"}]}
```

---

## CURRENT ADAPTER CONTRACT（`sk-adapter.mjs`）

| Item | Current implementation |
|---|---|
| URL | `POST {SK_SMS_BASE_URL}/goip_post_sms.html` |
| Auth | **Query only**: `username` + `password` from ENV |
| Body auth fields | **Not** duplicated into JSON body |
| Headers | Only `content-type: application/json;charset=utf-8` — **no** Cookie/Bearer for SK |
| Body shape | `type/send-sms` + `tasks[].tid/to/sms` (+ optional `from`) |
| Maps SK fail → Bridge client | `SMS_SEND_FAILED` / timeout / unavailable — **never** `UNAUTHORIZED` |

---

## MATCH / MISMATCH

| Aspect | Verdict |
|---|---|
| Path `/goip_post_sms.html` | **MATCH** |
| Method POST + JSON tasks | **MATCH** |
| Auth via query `username`/`password` | **MATCH**（与官方示例一致） |
| Auth via body username/password | Optional in doc；adapter 未放 body — **ACCEPTABLE**（非本次 401 根因） |
| Auth via Header / Cookie | Doc 非必须；adapter 未用 — **MATCH intent** |
| Error code `UNAUTHORIZED` from SK adapter | **N/A** — adapter 不产生该码 |

**SK adapter vs SK device contract: MATCH（for documented query-auth path）**  
**本次 Smoke 失败点: Bridge Service Token 层 — NOT SK adapter mismatch**

---

## 401 ROOT CAUSE

```
smoke-once.ps1
  → POST http://100.105.217.7:8791/internal/v1/sms/send
  → Authorization: Bearer <pasted token>
  → server.mjs authorize() 比较 BRIDGE_SERVICE_TOKEN
  → mismatch / whitespace / wrong token / different process ENV
  → HTTP 401 + errorCode=UNAUTHORIZED
  → skSendSms() NEVER CALLED
  → no SMS to SK / no phone delivery
```

Contributing factors to verify operationally（不读 Secret）：

1. Smoke 窗口粘贴的 token 与 Bridge 进程启动时的 `BRIDGE_SERVICE_TOKEN` **不一致**  
2. 粘贴带入首尾空格 / 换行  
3. Bridge 由 A 环境启动，Smoke 用了 B 环境的 token  
4. Smoke 脚本在 catch 里把“收到 HTTP 响应”标成 `SK_REQUEST=PASS` —— 命名易误导（实为 Bridge HTTP 已响应，不代表 SK 已请求）

---

## Account / restriction checklist（SK 侧 — 尚未被本轮触达）

| Topic | Status |
|---|---|
| API 专用账号 vs Web 登录账号 | Prior docs 提及 API 用户（如 `zrh_sms_api`）；**本轮未验证**（因未打到 SK） |
| IP / source restriction | Possible；需在 **token 修复后再**用 Bridge 日志看 `sk_sms_send` |
| Web UI “Login restricted” | 历史曾出现；影响 Web 管理页，**不等于** HTTP API 合同本身 |
| 权限不足 | SK 可能返回 `access restricted!`（HTTP 200 + code:1）— **本轮未见** |

---

## CODE CHANGE REQUIRED

| Change | Required now? |
|---|---|
| Rewrite SK auth to Header/Cookie | **NO** |
| Change query→body auth | **NO**（非 401 根因；可选加固：query+body 双写） |
| Fix smoke result naming (`BRIDGE_HTTP` vs `SK_REQUEST`) | YES（建议，防误判） |
| Auth/OTP/Bridge rewrite | **NO** |

**CODE CHANGE REQUIRED: NO（for SK adapter contract）**  
Optional later: smoke script clarity + body-auth dual write — not blockers for root cause.

---

## SK CONFIG CHANGE REQUIRED

| Change | Required now? |
|---|---|
| Reset SK password | **NO**（本轮未证明 SK 拒密） |
| Unlock Web UI | Only if 赵总要进管理页核对 API 用户权限 |
| Confirm API user enabled for HTTP Interface | **Recommended ops check** after Bridge token fixed |

**SK CONFIG CHANGE REQUIRED: NO for this 401**  
**OPS REQUIRED: align Bridge Service Token used by Smoke/XI GAME with Bridge process ENV**

---

## 赵总操作步骤（如需人工确认 SK API 权限 — 不读凭据）

1. 在可访问 `10.1.1.77` 的本机浏览器打开 SK Web（勿把密码发聊天）。  
2. 若页面显示 Login restricted / 倒计时：等待解锁，勿连续撞登录。  
3. 登录后查找 **HTTP Interface / API user** 相关配置，确认用于 `goip_post_sms.html` 的 API 用户已启用。  
4. 确认该用户与 Bridge ENV 中的 `SK_SMS_USERNAME` 为同一 API 账号（不要把 Web-only 账号误当 API）。  
5. **先不要发短信。** 下一步应先做：Bridge token 对齐验证（对 `/internal/v1/sms/send` 用正确 Bearer 得到非 401；可用无效手机号负向测试，或只看 Bridge 是否进入 `sk_sms_send` 日志）。  

---

## READY FOR ONE RETRY

**NO** — 直到同时满足：

1. Smoke/XI GAME 使用的 `BRIDGE_SERVICE_TOKEN` 与 Bridge 进程 ENV **一致**（本机验证：send 不再返回 401）  
2. Bridge 日志出现 `event=sk_sms_send`（证明已进入 SK adapter）  
3. 赵总再次批准 **仅 1 条** 真实短信  

满足后才：`READY FOR ONE RETRY = YES`

---

## Verdict block

```
SK AUTH CONTRACT:           Query/Body username+password on /goip_post_sms.html
CURRENT ADAPTER CONTRACT:   Query username+password + JSON send-sms tasks
MATCH/MISMATCH:             MATCH (SK adapter ↔ SK doc)
401 ROOT CAUSE:             Bridge Service Token unauthorized (authorize failed; SK not reached)
CODE CHANGE REQUIRED:       NO (SK adapter)
SK CONFIG CHANGE REQUIRED:  NO (for this 401)
READY FOR ONE RETRY:        NO
```

**已停笔。未重发短信。未开启 Stub/Mock/123456。**

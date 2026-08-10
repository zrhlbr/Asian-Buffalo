# PLAYER-AUTH-1A.1 — INVALID_PHONE ROOT CAUSE AUDIT

**Date:** 2026-08-11  
**Mode:** Read-only audit → code fix + unit tests + production deploy of normalizer  
**No Auth OTP SMS sent in this step**

---

## PRODUCTION REGISTER ROUTE

```
POST /api/v1/auth/register/start
Body: { "channel": "sms"|"email", "destination": "<string>" }
Impl: app/api/v1/auth/[...slug] → lib/player-auth-api.ts → authRegisterStart()
```

Error shape: `{ "error": { "code": "INVALID_PHONE", "message": "..." } }` HTTP 400

---

## EXPECTED PHONE FORMAT（产品 / 修复后）

| Input | Canonical |
|---|---|
| `09xxxxxxxxx` | `+959xxxxxxxxx` |
| `9xxxxxxxxx`（bare national） | `+959xxxxxxxxx` |
| `959xxxxxxxxx` | `+959xxxxxxxxx` |
| `+959xxxxxxxxx` | `+959xxxxxxxxx` |
| `00959…` / `0959…` | `+959…` |
| illegal | `INVALID_PHONE` |

Country calling code = **95**（2 digits）.  
National mobile starts with **9** → E.164 外观为 `+959…`（第三位 9 属于国内号，不是国家码）。

---

## NORMALIZER PRESENT / WIRED

| Check | Result |
|---|---|
| `lib/phone-normalize.ts` in Production image | **YES**（已部署） |
| Wired via `resolveSmsDestination()` in `authRegisterStart` | **YES** |
| Order | raw → trim → **normalize** → validate inside normalize → uniqueness → OTP |

**未出现** raw→validate→INVALID→normalize 倒置。  
OTP / Bridge / SK 仅在 normalize+unique 通过后调用。

---

## FRONTEND / BACKEND RULE MATCH

| Client | Behavior |
|---|---|
| Lobby `auth-app.tsx` | 发送**原始**输入；后端 normalize |
| `register-e2e.ps1`（失败当次） | **客户端预转换**成 `+…` 再提交 — 与后端双路径，易误判 |

修复：`register-e2e.ps1` 改为提交 **raw** destination（与正式前端一致）。

---

## ROOT CAUSE

**代码缺陷（主因）+ 当次输入 mask 不一致（次因）**

1. **Bug:** `normalizePhoneE164` 把缅甸校验写成 `startsWith("959")` + `slice(3)`，把国家码误当成 3 位 `959`。  
   正确国家码是 **`95`**，国内号 `9…` 应用 `slice(2)`。  
   后果：部分合法 `09…`（规范化后国内号以 9 开头）被误判为 `Myanmar mobile must start with 9` → API `INVALID_PHONE`。

2. **当次失败 mask:** `****4437`（与烟测成功 `****6188` 不同）— 操作输入不一致，也会直接 400。

3. **SK 未调用:** REGISTER_START 在 validation 失败返回；未进入 `startOtpChallenge` → 无 Bridge/SK 发送。

---

## CODE FIX REQUIRED

**YES — 已完成（本轮）**

- 重写 `lib/phone-normalize.ts`（CC=95, national `slice(2)`, 支持 00959/0959/bare 9…）  
- `tests/phone-normalize.test.mjs`：**10/10 PASS**  
- `register-e2e.ps1`：改为 raw destination  
- Production：已上传并 rebuild（部署进行中/完成见终端）

---

## TESTS

```
node --experimental-strip-types --test tests/phone-normalize.test.mjs
→ 10/10 PASS
```

覆盖：09 / +959 / 959 / bare 9 / 00959 / 0959 / 合法 09短号 / 非法号。

---

## SK CALLED THIS ATTEMPT

**NO**（validation 阶段失败；无 OTP send；无 Bridge accept）

---

## PRODUCTION DEPLOY REQUIRED

**YES — DONE**

- Image: `sha256:46b7db75e75cbb632fc7a873747edce32552f3f57bb863a34a3a9e0d3af7089d`  
- Health: **healthy**  
- Proven in container: `country calling code is 95` + `national = digits.slice(2)`

---

## READY FOR ONE AUTH OTP RETRY

**YES（代码/部署门禁已过）— 仍须赵总再次人工批准后才可发送**

条件：

1. ~~Production rebuild healthy + CC=95~~ **PASS**  
2. 赵总再次明确批准 **ONE AUTH OTP SEND**  
3. 使用与烟测相同的批准测试号（勿改号；mask 参考 `****6188`）

---

## Final block

```
PRODUCTION REGISTER ROUTE:     POST /api/v1/auth/register/start
EXPECTED PHONE FORMAT:         09… / 9… / 959… / +959… → canonical +959…
NORMALIZER PRESENT:            YES
NORMALIZER WIRED TO REGISTER:  YES (order: normalize→validate→OTP)
FRONTEND/BACKEND RULE MATCH:   FIXED (e2e now raw; lobby already raw)
ROOT CAUSE:                    CC treated as 959+slice(3); valid MM mobiles rejected + input mask mismatch
CODE FIX REQUIRED:             YES (done)
TESTS:                         PASS 10/10
SK CALLED THIS ATTEMPT:        NO
PRODUCTION DEPLOY REQUIRED:    YES (done — sha256:46b7db75… healthy)
READY FOR ONE AUTH OTP RETRY:  YES (await 赵总批准 ONE AUTH OTP SEND)
```

**已停笔。未发送真实短信。**

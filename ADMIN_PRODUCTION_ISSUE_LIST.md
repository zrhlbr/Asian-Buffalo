# ADMIN_PRODUCTION_ISSUE_LIST

**Date (UTC):** 2026-08-10  

## Open P0

**0**

## Open P1

**0**（功能性阻塞已关闭；下列为已知限制 / 卫生项）

## Closed during deploy

| ID | Severity | Status | Notes |
|---|---|---|---|
| BUILD-MISSING-PLAYER-CONTENT | P0 | CLOSED | 首轮 Build FAIL；补 `lib/player-content.ts` 后 PASS；未强行改无关代码 |
| PLAYERS-EMAIL-COLUMN | P0 | CLOSED | `pf.email` 缺列导致 500；加性 ALTER 后 PASS |

## Known limitations（诚实记录，非伪造 PASS）

| ID | Severity | Status | Notes |
|---|---|---|---|
| PLAYER-CONTENT-SYNC-PARTIAL | — | OPEN/PARTIAL | Lobby 仍可能硬编码；本次不改玩家 Lobby |
| ADMIN-1H-NOT-DONE | — | OPEN | 不得伪造 ADMIN-1H PASS |
| CF-BOT-1010-AUTOMATION | P2 | OPEN | 服务器自动化经公网 POST 可能 1010；真实浏览器/UA GET 正常 |
| PROBE-DRAFT-BANNERS | P3 | OPEN | S-18 探测留下 DRAFT `probe` / `probe2`；未发布 |
| UI-SCREENSHOT-GAP | P3 | OPEN | 本会话无 browser MCP；需补 1440/390 截图档 |

## Non-issues（明确不是缺陷）

- Roles `editable=false`：预期真实状态  
- Money confirm/pay `PROVIDER_NOT_CONFIGURED`：预期 GATE CLOSED  
- Dirty Git tree 未 Commit：按部署纪律，成功后再单独收口  

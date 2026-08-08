# Wallet Center — REGRESSION_REPORT

## Required PASS (scope discipline)

| Check | Result |
|-------|--------|
| Lobby home structure not redesigned | PASS — only `nav === "wallet"` body swapped |
| Hub untouched | PASS — no edits to `bdk-hub.tsx` this stage |
| Play / m5 untouched | PASS — no edits this stage |
| Player Center untouched | PASS — `player-center.tsx` / `.css` not edited |
| Wallet/Ledger business rules | PASS — reused panels/APIs only |
| Auth / Admin / DB | PASS — not touched |
| Fake balances / chart series | PASS — loading/empty/NO DATA/pending only |
| Hydration / keep-alive | PASS — modules not edited |
| Commit / push / merge / deploy | PASS — not performed |

## Functional smoke (code-level)

| Flow | Expectation |
|------|-------------|
| Tap 【钱包】 | Renders `data-testid="xi-wallet-center"` |
| Balance | Shows API/cache values or loading/error — never invented |
| 充值 / 提现 | Opens sheet with commerce panels + readiness banners |
| 流水 | Filters + recentMoves or empty |
| Records tabs | Deposit/withdraw/activity/redpacket honest empty; game binds wins API |
| 【我的】 | Still `PlayerCenter` (unchanged) |

## Residual risk

Headed visual regression screenshots not captured this run (BLOCKED_CAPTURE).

# BLOCKED_CAPTURE — Wallet Center screenshots

**Status:** BLOCKED this run  

## Why

1. No running local dev server detected in agent terminals.  
2. `cursor-ide-browser` MCP server unavailable in this subagent environment.  
3. Package rule: do not deploy / start production; optional local headed capture deferred.

## Planned shots (when unblocked)

| ID | Viewport | Lang | Target |
|----|----------|------|--------|
| wc-01 | 390×844 | zh-CN | Wallet Center overview |
| wc-02 | 320×568 | zh-CN | Narrow phone |
| wc-03 | 430×932 | en | Overview EN |
| wc-04 | 390×844 | my-MM | Overview MY |
| wc-05 | 390×844 | zh-CN | Deposit sheet + readiness banner |
| wc-06 | 390×844 | zh-CN | Withdraw sheet + history shell |
| wc-07 | 390×844 | zh-CN | Ledger filters |
| wc-08 | 768×1024 | zh-CN | Tablet two-column cards |

## Unblock steps

1. Start local `npm run dev` (or project win equivalent).  
2. Open `/xi`, sign in if required for balance APIs.  
3. Tap bottom nav 【钱包】 / Wallet.  
4. Capture list above into `docs/m8-review/xi-game-v2/wallet-center/screenshots/`.

Until then: UI is implemented; visual evidence pending.

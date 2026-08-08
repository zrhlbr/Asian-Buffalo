# 《西游戏》Stage Wallet Center（钱包中心）— MODULE_IMPACT_ANALYSIS

**Date:** 2026-08-08  
**Rule:** Development Rules V2.0 — analyze before code; whitelist-only; NO commit/push/merge/deploy  
**Scope:** Bottom nav 【钱包】→ commercial Wallet Center (platform money hub UI)  
**Entry:** `/xi` lobby bottom nav `wallet` (`data-testid="xi-nav-wallet"`)  
**Ban:** Lobby V3 home redesign · Hub · Play · Player Center redesign · Wallet/Ledger business rules · Auth · Admin · Math/RTP · live PSP production · fake balances

---

## 0. Hard bans (pre-code lock)

| Ban | Enforcement |
|-----|-------------|
| Lobby home Hero / Recommended / Quick redesign | Zero structural edits to home sections; wallet tab body swap only |
| Hub / Play / Reel / Spin / RNG / RTP / Math / Round | Zero edits under `client/m5/**`, `bdk-hub`, `play-shell`, game host/lifecycle |
| Player Center redesign | `player-center.tsx` / `.css` untouched |
| Wallet-Ledger / Deposit-Withdrawal settlement rules | Reuse existing panels/APIs only; no ledger math / fail-closed readiness changes |
| Auth / Admin / DB / Migration | Forbidden |
| Production PSP enablement | Deposit/Withdraw = UI + status shells / existing TEST harness only |
| Fake balances / invented jackpots / fake chart series | Honest loading / empty / NO DATA / Coming Soon / reserved |
| Commit / push / merge / deploy | Forbidden this package |
| Hydration / P1 keep-alive breakage | No edits to `layer-keepalive` / hydration store |

---

## 1. Current state (before code)

| Surface | Current | Gap |
|---------|---------|-----|
| Wallet tab (`nav === "wallet"`) | Thin `WalletPanel` + recharge/withdraw buttons | Not a commercial Wallet Center |
| Balance MMK | Parent `fetchBalance` → `/api/v1/game/wallet/balance` | Reuse; never invent |
| Wallet snapshot / recent moves | `fetchWalletSnapshot` → `/api/v1/game/wallet` | Reuse for ledger shell |
| Deposit / Withdraw panels | `commerce-panels` TEST harness + NOT_PRODUCTION_READY | Embed as shells; no rule changes |
| Game win-loss list | `fetchWins` → `/api/v1/game/wins` | Bind under records tab when present |
| Deposit/withdraw history lists | No dedicated list API | Honest empty + filters UI |
| Activity rewards / red-packet history | No dedicated list API | Reserved / empty shell |
| Asset trend chart | Missing | Placeholder NO DATA only |
| USDT | `usdtSupported` flag or pending | Honest pending when unsupported |
| Player Center wallet shortcuts | Already deep-links WalletPanel sheet | Leave alone |

---

## 2. Target structure (locked)

1. **Top:** total assets (MMK from API), MMK / USDT summary, trend reserved (NO DATA)  
2. **Asset cards:** MMK / USDT — balance + shortcuts 充值 / 提现 / 流水  
3. **Funds records:** tabs (deposit / withdraw / game win-loss / activity rewards / red-packet) + search/filter/pagination UI  
4. **Deposit UI:** MMK / USDT / ZRHPay reserved — embed existing DepositPanel + readiness banner (not production)  
5. **Withdraw UI:** embed WithdrawPanel + review status + history shells  
6. **Ledger / 流水:** income / expense / reward / refund / game settle filters + date/type; bind `recentMoves` when API returns rows, else empty  

---

## 3. ALLOWED_FILES (whitelist)

| File | Allowed change |
|------|----------------|
| `client/xi-lobby/wallet-center.tsx` | **NEW** — Wallet Center module |
| `client/xi-lobby/wallet-center.css` | **NEW** — scoped mythic black-gold styles |
| `client/xi-lobby/lobby-app.tsx` | Minimal: import + replace wallet tab body only |
| `client/xi-lobby/i18n.ts` | New `lobby.wc.*` keys; zh/en/my parity |
| `docs/m8-review/xi-game-v2/wallet-center/**` | Delivery package |

**Import-only (no business edits):** `api.ts`, `commerce-panels.tsx`, `player-center.tsx` (untouched).

---

## 4. FORBIDDEN_FILES

- `client/xi-lobby/player-center.tsx`, `player-center.css`
- `client/xi-lobby/bdk-hub.tsx`, `play-shell.tsx`, `game-host.tsx`, `game-lifecycle.ts`, `layer-keepalive.tsx`, `xi-shell.tsx`
- Lobby home Hero / recommended / quick structure rewrite in `lobby-app.tsx` / `lobby.css`
- `client/m5/**` reel/spin/math
- Wallet/ledger/session/spin/round API business; `app/admin/**`; auth-core rewrite
- DB / migration; production PSP config

---

## 5. API reuse (no new settlement)

| Need | Source | Status |
|------|--------|--------|
| Balance MMK | parent `balance` → `/api/v1/game/wallet/balance` | Real |
| Wallet snapshot / recentMoves | `fetchWalletSnapshot` → `/api/v1/game/wallet` | Real (empty list OK) |
| Game win-loss | `fetchWins` → `/api/v1/game/wins` | Real when rows exist |
| Deposit channels / order / test confirm | existing `DepositPanel` | Shell + TEST harness; readiness Fail Closed |
| Withdraw meta / submit | existing `WithdrawPanel` | Shell + readiness Fail Closed |
| Deposit/withdraw history lists | — | UI empty + filters (no fake rows) |
| Activity reward history / red-packet | — | Reserved / empty |
| Asset trend | — | NO DATA placeholder only |
| USDT balance number | only if API supports | Else pending / unavailable text |

---

## 6. Coming Soon / reserved (no fake data)

- Asset trend chart series  
- USDT live balance when `usdtSupported === false`  
- ZRHPay deposit rail (reserved label)  
- Red-packet records  
- Deposit / withdraw order history (until list API exists)  
- Pagination beyond client filter UI (shell)  

---

## 7. Regression must PASS

- Lobby home structure unchanged (Hero → ticker → recommended → quick → bottom nav)  
- Hub / Play / Player Center untouched  
- Hydration / keep-alive preserved  
- Wallet tab paints commercial center; no invented balances  
- Existing deposit/withdraw readiness banners still honest  

---

## 8. Delivery gates

1. MODULE_IMPACT_ANALYSIS.md (**this file — before edits**)  
2. WALLET_CENTER_DELIVERY.md  
3. MOBILE_REPORT.md  
4. I18N_REPORT.md  
5. RESPONSIVE_REPORT.md  
6. REGRESSION_REPORT.md  
7. MODULE_IMPACT.md (alias)  
8. FILE_LIST / REVIEW_PATCH / SHA256  
9. Screenshots or BLOCKED_CAPTURE  
10. git status note  

---

## 9. Pre-code decision

Proceed with whitelist-only Wallet Center UI module; wire via lobby 【钱包】 tab body swap; embed commerce panels as non-production shells; bind real balance / wallet / wins APIs only; all other records/trend = honest empty / reserved.

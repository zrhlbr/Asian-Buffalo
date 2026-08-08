# 《西游戏》Stage Wallet Center — DELIVERY

**Date:** 2026-08-08  
**Entry:** `/xi` → bottom nav 【钱包】 (`data-testid="xi-nav-wallet"`) → `WalletCenter`  
**Module:** `client/xi-lobby/wallet-center.tsx` + `wallet-center.css`  
**Commit / push / merge / deploy:** **NO** (this package)

---

## What shipped

Commercial **Wallet Center** as the lobby money hub UI (mythic black-gold), wired by swapping only the wallet tab body in `lobby-app.tsx`.

| Block | Behavior |
|-------|----------|
| Top assets | Total + MMK / USDT summary; trend = **NO DATA** reserved |
| Asset cards | MMK / USDT + 充值 / 提现 / 流水 |
| Funds records | Tabs + date/search filters + pager UI |
| Deposit sheet | Rails MMK / USDT reserved / ZRHPay reserved + existing `DepositPanel` (TEST / NOT_PRODUCTION_READY) |
| Withdraw sheet | Review status shell + `WithdrawPanel` + history empty shell |
| Ledger sheet | Type filters + date/search; binds `recentMoves` when API returns rows |

---

## Real API vs shell

### Real (bound)

| Data | Source |
|------|--------|
| MMK balance | Parent `balance` ← `/api/v1/game/wallet/balance` |
| Available / frozen / USDT flag / recentMoves | `fetchWalletSnapshot` ← `/api/v1/game/wallet` |
| Game win-loss list | `fetchWins` ← `/api/v1/game/wins` (records tab **游戏输赢**) |
| Deposit / withdraw actions | Existing commerce panels → deposit/withdraw routes (readiness Fail Closed / TEMP harness) |

### Shell / reserved (honest empty — no fake rows)

| Surface | Note |
|---------|------|
| Asset trend chart | NO DATA placeholder only |
| USDT numeric balance | Pending unless `usdtSupported` |
| USDT / ZRHPay deposit rails | Reserved labels |
| Deposit history list | Empty copy — no list API |
| Withdraw history / review timeline | Status shell + empty |
| Activity rewards history | Reserved empty |
| Red-packet records | Coming Soon empty |
| Pagination | Client UI over real/empty lists only |

**No invented balances or jackpots.** Loading / error / empty / pending only.

---

## Untouched confirmation

| Surface | Status |
|---------|--------|
| Lobby V3 home (Hero / ticker / recommended / quick) | Untouched structure |
| Hub (`bdk-hub.tsx`) | Untouched this stage |
| Play (`play-shell` / m5) | Untouched this stage |
| Player Center (`player-center.tsx` / `.css`) | Untouched |
| Wallet/Ledger business rules / Auth / Admin / Math/RTP | Untouched |
| Hydration / keep-alive modules | Untouched |

---

## Files (whitelist)

- `client/xi-lobby/wallet-center.tsx` **NEW**
- `client/xi-lobby/wallet-center.css` **NEW**
- `client/xi-lobby/lobby-app.tsx` — wallet tab body → `<WalletCenter />` only
- `client/xi-lobby/i18n.ts` — `lobby.wc.*` zh/en/my
- `docs/m8-review/xi-game-v2/wallet-center/**`

---

## Gates / reports

| Artifact | Status |
|----------|--------|
| MODULE_IMPACT_ANALYSIS.md | Written **before** code |
| I18N | `assertLobbyI18nComplete()` → `{ ok: true, missing: [] }` |
| Screenshots | See BLOCKED_CAPTURE.md (no local browser/server this run) |
| DB / Push / Merge / Rebase | **No** |

---

## Risks / unfinished

- Deposit/withdraw remain non-production until business sign-off (existing readiness).
- Dedicated deposit/withdraw order-list APIs not bound (honest empty).
- Visual QA screenshots pending headed device / local server.
- Full tsc/eslint/build suite not re-run as package gate (i18n assert PASS; lint IDE clean on touched TSX).

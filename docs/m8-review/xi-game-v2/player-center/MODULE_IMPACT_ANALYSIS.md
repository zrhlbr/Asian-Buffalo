# 《西游戏》Stage Player Center（我的）— MODULE_IMPACT_ANALYSIS

**Date:** 2026-08-08  
**Rule:** Development Rules V2.0 — analyze before code; whitelist-only; NO commit/push/merge/deploy  
**Scope:** Bottom nav 【我的】→ full commercial Me / Player Center  
**Entry:** `/xi` lobby bottom nav `me` (`data-testid="xi-nav-me"`)  
**Ban:** Lobby V3 home redesign · Hub · Play · Reel · Spin · Math · RTP · Wallet/Ledger business rules · Auth core rewrite · Admin

---

## 0. Hard bans (pre-code lock)

| Ban | Enforcement |
|-----|-------------|
| Lobby home Hero / Recommended / Quick redesign | Zero structural edits to home sections; Me tab swap only |
| Hub / Play / Reel / Spin / RNG / RTP / Math / Round | Zero edits under `client/m5/**`, `bdk-hub`, `play-shell`, game host/lifecycle |
| Wallet-Ledger / Deposit-Withdrawal settlement rules | Reuse panels/APIs only; no ledger math changes |
| Auth core / A1 rewrite | Reuse `authLogout` + forgot route; no auth API rewrite |
| Admin / DB / Migration | Forbidden |
| Fake balances / jackpots / security logs | Honest loading / empty / Coming Soon / reserved only |
| Commit / push / merge / deploy | Forbidden this package |

---

## 1. Current state (before code)

| Surface | Current | Gap |
|---------|---------|-----|
| Me tab (`nav === "me"`) | Minimal nick/ID/VIP + 2 buttons | Not a commercial Player Center |
| Profile | `/api/v1/game/profile` + topbar avatar | Reuse |
| Wallet balance | `/api/v1/game/wallet/balance` + `/api/v1/game/wallet` | Reuse; USDT may be unsupported → honest pending |
| VIP | `VipCenterPanel` + `/api/v1/game/vip*` | Reuse modal |
| Deposit / Withdraw | Commerce panels | Reuse modals |
| Activity / Check-in / Rankings | Commerce panels | Reuse |
| Game records | `RecordsPanel` + `fetchWins` | Wire from Me shortcuts |
| Auth logout | `authLogout` + `clearLobbyCaches` | Reuse bottom CTA |
| Language | `saveLobbyLang` / store | Instant switch, no reload |
| Security / CS / coupons / devices / KYC | Missing | UI shells + Coming Soon / reserved — no fake logs |

---

## 2. Target structure (locked)

1. **Top:** avatar, nick, UID, VIP — tap → profile / VIP where exists  
2. **Mid:** My Wallet MMK / USDT + total; shortcuts: recharge, withdraw, ledger/流水, game records  
3. **Group2:** activity, check-in, coupons (Coming Soon OK), rankings  
4. **Group3:** security center (change password if auth; devices/login history/phone/email/KYC/OTP reserved), language, CS, help, about  
5. **Bottom:** logout  

---

## 3. ALLOWED_FILES (whitelist)

| File | Allowed change |
|------|----------------|
| `client/xi-lobby/player-center.tsx` | **NEW** — Me / Player Center module |
| `client/xi-lobby/player-center.css` | **NEW** — scoped mythic black-gold styles |
| `client/xi-lobby/lobby-app.tsx` | Minimal: import + replace Me tab body; optional modal kinds for ledger/records if needed |
| `client/xi-lobby/i18n.ts` | New `lobby.me.*` keys; zh/en/my parity |
| `docs/m8-review/xi-game-v2/player-center/**` | Delivery package |

**Import-only (no business edits):** `api.ts`, `commerce-panels.tsx`, `auth-api.ts`, `ui-store.ts`, `nav.ts` (routes only).

---

## 4. FORBIDDEN_FILES

- `client/xi-lobby/bdk-hub.tsx`, `play-shell.tsx`, `game-host.tsx`, `game-lifecycle.ts`, `layer-keepalive.tsx`, `xi-shell.tsx`
- Hub/Play visual redesign; Lobby home Hero/rec/quick structure rewrite
- `client/m5/**` reel/spin/math
- Wallet/ledger/session/spin/round API business; `app/admin/**`; auth-core rewrite
- DB / migration

---

## 5. API reuse (no new settlement)

| Need | Source |
|------|--------|
| Profile | `fetchProfile` / parent state → `/api/v1/game/profile` |
| Balance MMK | parent `fetchBalance` → `/api/v1/game/wallet/balance` |
| Wallet snapshot / 流水 | `fetchWalletSnapshot` → `/api/v1/game/wallet` |
| VIP | existing modal + VIP APIs |
| Deposit / Withdraw | existing panels |
| Activity / Check-in / Rankings / Wins | existing panels/APIs |
| Logout | `authLogout` → `/api/v1/auth/logout` |
| Change password | navigate `/xi/forgot` (existing auth forgot) |
| USDT | show pending/unavailable unless API `usdtSupported` |

---

## 6. Coming Soon / reserved (no fake data)

- Coupons  
- CS channels (shell)  
- Security: devices, login history, phone bind, email bind, KYC, OTP — reserved UI  
- Help / About — static shell copy only (no invented metrics)

---

## 7. Regression must PASS

- Lobby home structure unchanged (Hero → ticker → recommended → quick → bottom nav)  
- Hub / Play untouched  
- Wallet/VIP/Auth/lang still work from topbar  
- Me tab paints commercial center; hydration-safe lang/profile  
- No fake balances  

---

## 8. Delivery gates

1. MODULE_IMPACT_ANALYSIS.md (**this file — before edits**)  
2. PLAYER_CENTER_DELIVERY.md  
3. PLAYER_CENTER_UI_REPORT.md  
4. I18N_REPORT.md  
5. RESPONSIVE_REPORT.md  
6. REGRESSION_REPORT.md  
7. MODULE_IMPACT (alias note if needed)  
8. FILE_LIST / REVIEW_PATCH / SHA256  
9. Screenshots or BLOCKED_CAPTURE  
10. git status note  
11. **NO commit / push / merge / deploy**

---

## 9. Blast radius

```
NEW player-center.tsx + player-center.css
MINIMAL lobby-app Me tab wire + i18n keys
╳ NOT lobby home redesign / hub / play / reel / wallet business / auth core / admin
```

---

## 10. Proceed gate

Impact analysis complete. Implementation may begin on ALLOWED_FILES only.

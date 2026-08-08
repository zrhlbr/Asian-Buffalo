# 《西游戏》Stage Player Center（我的）— DELIVERY

**Date:** 2026-08-08  
**Status:** Implemented (code + docs). Screenshots blocked — see `BLOCKED_CAPTURE.md`.  
**Commit / push / merge / deploy:** **NOT done** (forbidden).

---

## Entry

| Item | Value |
|------|-------|
| Route | `/xi` lobby |
| Tab | Bottom nav 【我的】`data-testid="xi-nav-me"` → `nav === "me"` |
| Module | `client/xi-lobby/player-center.tsx` (`data-testid="xi-player-center"`) |
| Wire | Minimal replace of Me tab body in `lobby-app.tsx` |

---

## Structure shipped

1. **Top** — avatar / nick / UID / VIP (tap → profile / VIP modals)  
2. **Mid** — My Wallet MMK + USDT (honest unavailable) + total; shortcuts: recharge / withdraw / ledger / game records  
3. **Group2** — activity / check-in / coupons (Coming Soon) / rankings  
4. **Group3** — security center / language / CS / help / about  
5. **Bottom** — logout (auth session) or login/register entry  

---

## APIs reused (no new settlement)

| Feature | API / helper |
|---------|----------------|
| Profile | Parent `fetchProfile` → `/api/v1/game/profile` |
| Balance MMK | Parent `fetchBalance` → `/api/v1/game/wallet/balance` |
| Wallet snapshot / 流水 | `fetchWalletSnapshot` → `/api/v1/game/wallet` + `WalletPanel` |
| Game records | `RecordsPanel` → `/api/v1/game/wins` |
| VIP | Existing `VipCenterPanel` modal |
| Deposit / Withdraw | Existing commerce modals |
| Activity / Check-in / Rankings | Existing modals / panels |
| Logout | `authLogout` → `/api/v1/auth/logout` + `clearLobbyCaches` |
| Change password | Navigate `/xi/forgot` (existing auth) |
| Language | `saveLobbyLang` — instant, no full reload |

---

## Coming Soon / reserved

- Coupons  
- CS channels (shell body)  
- Security reserved: devices, login history, phone, email, KYC, OTP  
- Help / About: static honest copy only  

---

## Confirmation — not redesigned

| Surface | Touched? |
|---------|----------|
| Lobby V3 home (Hero / ticker / recommended / quick) | **No** structure redesign — only Me tab body |
| Hub (`bdk-hub`) | **No** |
| Play / Reel / Spin / Math / RTP | **No** |
| Wallet/Ledger business rules | **No** — display + existing panels only |
| Auth core | **No** — logout/forgot reuse only |
| Admin / DB | **No** |

---

## Files (code)

- `client/xi-lobby/player-center.tsx` **NEW**  
- `client/xi-lobby/player-center.css` **NEW**  
- `client/xi-lobby/lobby-app.tsx` — Me tab wire  
- `client/xi-lobby/i18n.ts` — `lobby.me.*` zh/en/my  

See `FILE_LIST.md`, `REVIEW_PATCH.md`, `SHA256.txt`.

---

## Gates / tests

| Gate | Result |
|------|--------|
| `assertLobbyI18nComplete()` | **PASS** (`ok: true`) |
| Headed screenshots | **BLOCKED** — no local server in session |
| Commit / Push / Merge / Deploy | **NOT performed** |
| DB changed | **No** |

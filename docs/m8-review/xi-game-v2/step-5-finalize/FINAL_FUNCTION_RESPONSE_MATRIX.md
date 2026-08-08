# FINAL_FUNCTION_RESPONSE_MATRIX — Step 5

Legend: UI✅ API✅ = complete · UI✅ API❌ / UI❌ API✅ = incomplete · PENDING = BR / product gap · N/A = intentional stub

| Surface | Entry | UI | API | End-to-end | Notes |
|---------|-------|----|-----|------------|-------|
| Lobby | Brand / hero | ✅ | N/A | ✅ | 西游戏 |
| Lobby | Games catalog | ✅ | ✅ | ✅ | `/api/v1/lobby/catalog` |
| Lobby | Balance meter | ✅ | ✅ | ✅ | `/wallet/balance` |
| Lobby | Deposit / recharge | ✅ | ✅ | ⚠ TEMP | NOT_PRODUCTION_READY banner; test confirm only |
| Lobby | Withdraw | ✅ | ✅ | ⚠ TEMP | Placeholder limits; hold works |
| Lobby | Check-in | ✅ | ✅ | ✅ | Idempotent daily |
| Lobby | Activity | ✅ | ✅ | ✅ | Expired blocked |
| Lobby | VIP | ✅ | ✅ | ✅ | Levels RO + claim |
| Lobby | Profile | ✅ | ✅ | ✅ | |
| Lobby | Announcements | ✅ | ✅ | ✅ | Schedule filter |
| Lobby | Messages / CS | ✅ | N/A | N/A | Coming-soon modal (BR-008) — not dead |
| Lobby | Settings / lang | ✅ | N/A | ✅ | zh/en/my |
| Hub BDK | Start game | ✅ | N/A | ✅ | → `/xi/bull-demon-king/play` |
| Hub | Recharge/Withdraw/Wallet | ✅ | ✅ | ⚠ TEMP | Same commerce |
| Hub | VIP/Activity/Check-in | ✅ | ✅ | ✅ | |
| Hub | Rules/Paytable/BetHelp | ✅ | N/A | ✅ | Static formal copy |
| Hub | Rankings | ✅ | ❌ | incomplete | Empty shell — no rankings API |
| Hub | Records / wins | ✅ | ✅ | ✅ | `/wins` RO |
| Hub | CS/Help | ✅ | N/A | N/A | Coming soon (not dead) |
| Play | Session→Spin→Round | ✅ | ✅ | ✅ | Formal provider |
| Play | Wallet HUD | ✅ | ✅ | ✅ | Server refresh |
| Play | Back to hub | ✅ | N/A | ✅ | Safe leave |
| Admin | Deposits | ✅ | ✅ | ✅ | Real API; test confirm gated |
| Admin | Withdrawals | ✅ | ✅ | ✅ | approve/reject/pay + RBAC |
| Admin | Activities | ✅ | ✅ | ✅ | |
| Admin | VIP | ✅ | ✅ | ✅ | |
| Admin | Wallet/Ledger/Math | ✅ | ✅ | ✅ | **RO** mutations absent |
| Admin | Players freeze | ✅ | ✅ | ✅ | reason + audit |
| Payment live PSP | KBZ/Wave/TRC20 | ✅ banner | ❌ live | incomplete | TEMP until Zhao secrets |

## Incomplete (must not claim RC money-ready)

1. Live provider callbacks / HMAC / recon (BR-007)
2. Signed deposit/withdraw amounts (BR-005/006)
3. Rankings API (hub UI shell only)
4. Support ticket SLA (BR-008)
5. USDT live (BR-009)

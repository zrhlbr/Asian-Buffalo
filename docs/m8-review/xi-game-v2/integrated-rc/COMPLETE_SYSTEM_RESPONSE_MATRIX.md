# COMPLETE_SYSTEM_RESPONSE_MATRIX — Integrated RC

Legend: UI✅ API✅ = complete · UI✅ API❌ / UI❌ API✅ = **incomplete** · ⚠ TEMP = wired but NOT_PRODUCTION_READY · PENDING = BR/product · N/A = intentional stub

| Surface | Entry | UI | API | E2E | Notes |
|---------|-------|----|-----|-----|-------|
| Lobby | Brand 西游戏 | ✅ | N/A | ✅ | |
| Lobby | Catalog | ✅ | ✅ | ✅ | BDK → `/xi/bull-demon-king` |
| Lobby | Balance | ✅ | ✅ | ✅ | |
| Lobby | Deposit | ✅ | ✅ | ⚠ TEMP | readiness NOT_PRODUCTION_READY |
| Lobby | Withdraw | ✅ | ✅ | ⚠ TEMP | placeholder limits |
| Lobby | Check-in / Activity / VIP | ✅ | ✅ | ✅ | |
| Lobby | Profile / Announcements | ✅ | ✅ | ✅ | |
| Lobby | Messages / CS | ✅ | N/A | N/A | coming-soon (BR-008) |
| Hub | Start game | ✅ | N/A | ✅ | → play |
| Hub | Commerce / VIP / Wins | ✅ | ✅ | ✅/⚠ | same APIs |
| Hub | Rankings | ✅ | ❌ | **incomplete** | empty shell |
| Hub | Rules/Help | ✅ | N/A | ✅ | static |
| Play | Session/Spin/Round | ✅ | ✅ | ✅ | formal provider |
| Play | Wallet HUD | ✅ | ✅ | ✅ | |
| Play | Back to hub | ✅ | N/A | ✅ | safe leave |
| Compat | `/` `/game` | ✅ | N/A | ✅ | 308 → play |
| Admin | Login `/admin` `/admin/login` | ✅ | ✅ | ✅ | |
| Admin | Deposits / Withdrawals | ✅ | ✅ | ✅ | smoke 200 |
| Admin | Activities / VIP | ✅ | ✅ | ✅ | unit + modules |
| Admin | Players list/detail | ✅ | ⚠ | **gap** | live smoke HTTP 500 |
| Admin | Audit logs | ✅ | ✅ | ✅ | `logs/admin` |
| Admin | Wallet/Ledger/Math | ✅ | ✅ | ✅ | RO |
| Payment live PSP | KBZ/Wave/TRC20 | ✅ banner | ❌ live | **incomplete** | TEMP |

## Incomplete (must not claim money Production Ready)

1. Live PSP callbacks / HMAC / recon (BR-007)
2. Zhao-signed deposit/withdraw amounts (BR-005/006)
3. Hub rankings API
4. Admin players live 500 (investigate; unit green)
5. Support tickets (BR-008) / USDT live (BR-009)
6. Real-device FPS **NOT TESTED**

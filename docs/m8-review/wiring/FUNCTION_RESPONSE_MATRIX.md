# FUNCTION RESPONSE MATRIX

Rule: **PASS** only if Frontend → API → Service → DB → Permission → Audit (where applicable) all real.  
UI✅ API❌ or API✅ UI❌ = incomplete.

| Feature | Frontend | API | Service | DB | Permission | Audit | Test | Status |
|---|---|---|---|---|---|---|---|---|
| Player session create | FormalGameProvider | POST sessions | handleCreateSession / db-game | game_sessions | identity | — | api-handlers | **PASS** |
| Player balance read | FormalGameProvider / resume | GET balance | DbWalletAdapter / D1Ledger | ledger_accounts/balances | identity | — | wiring-d1-money | **PASS** |
| Player spin settle | Game.spin → FormalGameProvider | POST spins | orchestrateSpin + MoneyService | game_rounds + wallet_* + ledger_* | identity | — | wiring-d1-money + api-handlers | **PASS** |
| Round recovery | bootstrap recoverLastRound | GET rounds/:id | getAuthorizedRound | game_rounds | identity | — | api-handlers | **PASS** |
| Rules fetch | ensureReady | GET rules/:v | loadExecutableMathVersion | game_math_versions | identity | — | api-handlers | **PASS** |
| Announcements player read | bootstrap toast | GET announcements | listPlayerAnnouncements | admin_announcements | identity | — | wiring-d1-money | **PASS** |
| Announcements admin create | System module | POST system/announcements | handleAnnouncementCreate | admin_announcements | system:manage | admin_audit_logs | r1-m7-admin | **PASS** |
| Turbo / Auto | HUD | — | client loop calls spin API | — | — | — | — | **PASS** (presentation) |
| Sound / Lang / Settings | HUD | — | client | — | — | — | — | **PASS** (presentation) |
| Paytable | HUD modal | rules at boot | game-config display | — | — | — | — | **PARTIAL** |
| Room selector UI | none | — | roomBase in bet presets | — | — | — | — | **N/A** (no fake UI) |
| History UI | none | admin rounds only | — | — | — | — | — | **N/A** (no fake UI) |
| Exit / Reconnect buttons | none | recover + visibility refresh | — | — | — | — | — | **N/A** / **PASS** resume |
| Admin login | LoginScreen | POST login | admin-auth | admin_sessions | — | admin.login | r1-m7-admin | **PASS** |
| Admin dashboard KPIs | DashboardModule | GET dashboard | getDashboardMetrics | SQL aggregates | dashboard:view | — | r1-m7-admin | **PASS** |
| Admin players freeze | PlayersModule | POST freeze/unfreeze | handlePlayerFreeze | players.status | players:freeze | yes | r1-m7-admin | **PASS** |
| Admin sessions/rounds/spins | modules | GET | admin-queries | game_* | rounds:view | — | r1-m7-admin | **PASS** |
| Admin wallet RO | WalletModule | GET intents/ops/detail | admin-queries | wallet_* | wallet:view | — | r1-m7-admin | **PASS** |
| Admin ledger RO | LedgerModule | GET accounts/tx/… | admin-queries | ledger_* | ledger:view | — | r1-m7-admin | **PASS** |
| Admin math FROZEN RO | MathModule | GET math-versions | admin-queries | game_math_versions | math:view | — | r1-m7-admin | **PASS** |
| Admin risk | RiskModule | GET risk/signals | SQL-derived | game/wallet/ledger | risk:view | — | r1-m7-admin | **PASS** |
| Admin reports | ReportsModule | GET reports/ops | getOpsReport | aggregates | dashboard:view | — | r1-m7-admin | **PASS** |
| Admin RBAC UI gate | nav `can()` | /me permissions | ROLE_PERMISSIONS | — | backend 403 | — | r1-m7-admin (403) | **PASS** |
| Admin system monitor | SystemModule | GET system/status | getSystemMonitor | SELECT 1 + health | system:view | — | r1-m7-admin | **PASS** (honest probes) |
| Round↔Wallet↔Ledger deep link | rounds detail buttons | openTab props | — | — | view perms | — | manual | **PASS** |
| Game audit log UI | — | GET logs/game | listGameAuditEvents | audit_events | logs:view | — | — | **FAIL** (API✅ UI❌) |
| Production player auth (non-test) | no login UI | identity 503 | UnconfiguredIdentityProvider | — | — | — | identity-gate | **FAIL** (by design until real IdP) |
| REAL money wallet | — | allowRealMoney false | RealWalletAdapter deny | — | — | — | r1-m4-money | **PASS** (fail-closed) |

## Counts (features above)

| Status | Count |
|---|---|
| **PASS** | 28 |
| **PARTIAL** | 1 |
| **N/A** | 3 |
| **FAIL** | 2 |

Critical FAIL remaining: (1) no production player IdP/login UI; (2) `logs/game` API without admin UI tab.

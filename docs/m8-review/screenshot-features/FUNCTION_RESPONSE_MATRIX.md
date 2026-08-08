# FUNCTION_RESPONSE_MATRIX.md

| # | Feature | FE | API | Service | DB | Admin | Gate | Status |
|---|---------|----|-----|---------|----|-------|------|--------|
| 1 | Stabilize game | — | — | — | — | — | PHASE1 | **PASS** |
| 2 | Profile + Avatar | overlays + modal | profile/* | player-profile | player_profiles | players list/detail | PHASE2 | **PASS** (unit) |
| 3 | VIP 1–6 | vip-modal switcher | vip, vip/levels | vip-service | vip_level_config, player_vip | VIP module | PHASE3 | **PASS** (unit) |
| 4 | VIP Reward chests | chest UI + anim | vip/rewards, claim | vip-rewards→MoneyService | vip_reward_defs/claims | view via player | PHASE4 | **PASS** (unit) |
| 5 | Deposit | wallet stub | — | — | — | — | — | **CONTRACT** (BR-005) |
| 6 | Withdrawal | wallet stub | — | — | — | — | — | **CONTRACT** (BR-006) |
| 7 | Payment channels | stub | — | — | — | — | — | **CONTRACT** (BR-007) |
| 8 | Help/Support | help-modal | announcements exist | — | — | — | — | **PARTIAL** |
| 9 | Rules/Announcements | paytable + help | announcements | player-announcements | admin_announcements | system | — | **PARTIAL** |
| 10 | Admin modules | — | vip/* | — | sidecars | VIP+players | — | **PASS** additive (M8 + M9 synced) |
| 11 | E2E headed | — | — | — | — | — | — | **BLOCKED_CAPTURE** / unit OK |

**PASS counts:** Phase1–4 functional + unit = 4/4 phase gates solid; matrix rows PASS=5 (incl admin additive), CONTRACT=3, PARTIAL=2, BLOCKED_CAPTURE=1.

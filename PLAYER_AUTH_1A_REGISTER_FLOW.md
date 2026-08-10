# PLAYER_AUTH_1A_REGISTER_FLOW

**Date:** 2026-08-10

1. Phone（09 / +959）or email  
2. Normalize + uniqueness  
3. OTP request `purpose=register` → Bridge → SK（when configured）  
4. Verify OTP  
5. Password + optional nickname  
6. Create player + auth + profile + vip + prefs（compensating bundle）  
7. XI GAME session cookies → Lobby  

**Login:** password login retained（本阶段不改成 OTP Login）。  
**Forgot:** same OTP engine, `purpose=reset` / `RESET_PASSWORD`（不可混用 register OTP）。

**Live phone register:** **BLOCKED** — SK credentials MISSING；禁止 stub 假成功 / 禁止 DB 插假玩家。

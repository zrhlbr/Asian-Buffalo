# SECURITY_REPORT.md

- Identity fail-closed on game commerce routes (same runtime gate as wallet/spins).
- Profile PATCH rejects `balance` / `balanceMinor` / `amountMinor`.
- Reward claim rejects client `amountMinor`; server uses `vip_reward_defs` + idempotency.
- Phone stored server-side; admin list/detail shows masked PII only (`****XXXX`).
- Admin VIP mutations require reason + audit log.
- No destructive migrations; sidecars `CREATE IF NOT EXISTS`.
- Overlay close does not dispose WebGL (no forced context loss).
- P0 stacking: `#gl { transform: translateZ(0) }` kept; `#hud` shell not re-promoted.

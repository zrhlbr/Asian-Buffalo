# FRONTEND_BACKEND_CONTRACT — Integrated RC

**Base:** Step 4 + Step 5 contracts unchanged. Integration does not invent new money endpoints.

## Identity

| Surface | Auth | Player id source |
|---------|------|------------------|
| Lobby / Hub / Play APIs | `resolveActivePlayer` / runtime identity | Server only (`dev-test-player` under `AB_ALLOW_TEST_IDENTITY=1`) |
| Formal spin | same runtime identity | Server; client sends sessionId + bet fields only |
| Admin | Bearer `ab_admin` token / cookie | Admin identity ≠ player |

Client **never** supplies `playerId` / `balanceMinor` for authority.

## Shared wallet projection

| Client | Endpoint |
|--------|----------|
| Lobby / Hub meter | `GET /api/v1/game/wallet/balance` → `balanceMinor` |
| Wallet panel | `GET /api/v1/game/wallet` → available/frozen/moves |
| Play HUD | Formal provider → same balance API + spin `balanceAfterMinor` |

## Commerce readiness (fail-closed)

`GET deposit/channels` + `GET withdraw` expose `readiness.code = NOT_PRODUCTION_READY` until Zhao signs BR-005..007 + live PSP secrets.

## Admin FE ↔ API matrix (no orphans)

| UI module | API family |
|-----------|------------|
| dashboard | `dashboard` |
| players | `players`, freeze/unfreeze |
| vip | `vip/*` |
| activities | `activities` |
| sessions / rounds / spins | matching RO queries |
| risk / reports | matching |
| wallet / ledger / math | RO (no credit mutators) |
| deposits / withdrawals | config + review/pay |
| system / admins / logs | `system`, `admins`, `logs/*` |

## Live smoke note

`GET /api/admin/players` and `GET /api/admin/players/:id` returned **HTTP 500** on `:5173` during Phase C (deposits/withdrawals/audit OK). Unit admin suite still green. Tracked as remaining gap — not rewritten in this integrate pass.

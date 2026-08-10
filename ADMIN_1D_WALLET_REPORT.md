# ADMIN-1D Wallet Report

| Item | Result |
|------|--------|
| Wallet Center | YES — tab `balances` with Player / Currency / Total / Available / Frozen / Status / Updated |
| Wallet Detail | YES — `GET wallet/players/:id` + modal |
| Total / Available / Frozen | YES — distinct columns; Total = Available + Frozen |
| frozenMinor source | Commerce `sumFrozenWithdrawals` (open withdrawal holds) |
| Intents / Provider Ops | Preserved (secondary tabs) |
| Integrity tab | YES — `wallet:integrity:view` |
| Money gate banner | YES |
| Manual adjust | BLOCKED (not implemented) |

## API

- `GET /api/admin/wallet/balances`
- `GET /api/admin/wallet/players/:id` (audit: `wallet.detail.view`)
- `GET /api/admin/wallet/integrity` (audit: `wallet.integrity.view`)
- Existing intents/ops unchanged

## Links

- Player Detail → Wallet Center / Ledger
- Wallet Detail → Ledger / Player

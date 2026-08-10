# ADMIN-1D Frozen Balance Report

## Verdict: WALLET FROZENMINOR = YES

### Chain (authoritative)

```
DB: no frozen_minor column
 → Service: sumFrozenWithdrawals(withdrawal_requests open statuses)
 → Admin resolvePlayerWalletBalances / listWalletBalances SQL join
 → API: wallet/balances, wallet/players/:id, players/:id.walletSummary
 → UI: Wallet Center + Player wallet tab + Wallet Detail (fmtMinor)
```

### Formula (documented commerce model)

```
availableMinor = ledger_accounts.PLAYER_AVAILABLE.balance_minor
frozenMinor    = SUM(withdrawal_requests.amount_minor)
                 WHERE status IN (PENDING, UNDER_REVIEW, APPROVED, PAYING)
totalMinor     = availableMinor + frozenMinor
```

### Closed gap

| Before (ADMIN-1B/1C) | After (ADMIN-1D) |
|---------------------|------------------|
| Player detail guessed FROZEN/HOLD ledger kinds | Same commerce source as lobby snapshot |
| Wallet Center missing balances | Balances tab with Frozen column |
| PARTIAL | YES |

### Explicitly forbidden (not done)

- Frontend Total − Available guess without model
- Dual formula divergence

# ADMIN-1D RBAC Report

## Permissions (colon style)

| Spec name | Implemented | Notes |
|-----------|-------------|-------|
| wallet.view | `wallet:view` | YES |
| wallet.ledger.view | `ledger:view` | YES |
| wallet.deposit.view | `deposit:view` | YES |
| wallet.withdraw.view | `withdraw:view` | YES |
| wallet.integrity.view | `wallet:integrity:view` | NEW |
| wallet.adjust | — | **BLOCKED / not granted** |

## Role highlights

- FINANCE: wallet + integrity + ledger + deposit/withdraw (incl. pay permission; API gate still CLOSED)
- AUDIT / READONLY: view suite incl. integrity
- SUPPORT: wallet/deposit/withdraw view; **no** integrity
- SUPER_ADMIN: `*` but audit still written on sensitive views/mutations

## Backend enforcement

Unauthenticated → 401; wrong permission → 403. Not frontend-only.

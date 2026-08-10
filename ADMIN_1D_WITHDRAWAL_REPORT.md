# ADMIN-1D Withdrawal Report

| Item | Result |
|------|--------|
| Admin → Withdrawals list | YES |
| Fields | Order ID, Player, Currency, Amount, Fee, Net, Destination (masked), Status, timestamps |
| Destination PII | Masked (`accountMasked`) |
| Pagination / filter | YES |
| Pay | API gated `PROVIDER_NOT_CONFIGURED` when harness off (ADMIN-1D harden) |
| Approve/Reject UI | Hidden when gate closed; view/search/filter primary |
| Production payout | GATE CLOSED |

## Security

`POST withdrawals/:id/pay` now mirrors deposit confirm fail-closed behavior.

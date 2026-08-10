# ADMIN-1D Deposit Report

| Item | Result |
|------|--------|
| Admin → Deposits list | YES |
| Fields | Order ID, Player, Provider/Channel, Currency, Amount (`fmtMinor`), Status, Created/Updated |
| Statuses | Real system statuses (CREATED/PENDING/PROCESSING/SUCCESS/FAILED/REJECTED) |
| Pagination / filter | YES |
| Confirm credit | Harness-only; API returns `PROVIDER_NOT_CONFIGURED` (503) when gate closed |
| Fake success bypass | NOT ADDED; existing confirm remains fail-closed |
| Money gate banner | YES |

## Security note

Historical `POST deposits/:id/confirm` remains gated by `AB_ALLOW_TEST_IDENTITY=1`. UI hides confirm when harness off. Not a production money open.

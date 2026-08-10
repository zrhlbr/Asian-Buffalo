# R1-M9 Admin — Progress Notes

Baseline: `9654d4194d2db801467af34cef1ddc5650fd310f`  
Branch worktree: additive only · **no Commit / Merge / Push / PR**

## Module checklist

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Dashboard currency / room / sparklines | Done | `byCurrency` + sparkline UI; room = currency proxy (no room table) |
| 2 | Players risk + deep-links | Done | `riskTags` on detail; tab props → sessions/spins/wallet |
| 3 | Session/Round/Spin detail polish | Done | Filters + cross-links; spin detail shows grid/ledger |
| 4 | Wallet GET intents/:id + timeline | Done | Route + modal timeline |
| 5 | Ledger REVERSED/search/reversal/health RO | Done | Search/status/kind filters; health ID lists |
| 6 | Math RTP/usage RO UI | Done | List columns + detail StatCards |
| 7 | Reports DAU/MAU/retention/rankings | Done | Extended `getOpsReport` |
| 8 | Risk HF spin + honest multi-device | Done | `HIGH_FREQ_SPIN`; `MULTI_DEVICE_UNAVAILABLE` (no fake fingerprint) |
| 9 | Announcements draft/schedule/trilingual | Done | content JSON convention; no ALTER/migration |
| 10 | System monitor honest probes | Done | SELECT 1 latency + ledgerQueryable; config `value` binding fixed |
| 11 | i18n zh/en/my key parity | Done | New keys in all three locales |
| 12 | Responsive phone query/view | Done | CSS @640: full-width filters, kv stack, table scroll |
| 13 | Extend `tests/r1-m7-admin.test.mjs` | Done | 19/19 PASS (was 14) |
| 14 | Progress / risk / rollback docs | Done | This file + RISK + ROLLBACK |

## Test command

```bash
node --experimental-strip-types --test tests/r1-m7-admin.test.mjs
```

Result (latest): **19/19 PASS**.

## Hard stops preserved

- No Wallet / Ledger / Math / RTP / RNG / Paytable / DB history mutations
- Only game write remains players.status freeze/unfreeze (audited)
- Announcements use existing columns only

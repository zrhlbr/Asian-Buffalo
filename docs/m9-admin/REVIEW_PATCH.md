# R1-M9 Admin — Review Patch Summary

Baseline: `9654d4194d2db801467af34cef1ddc5650fd310f`  
Delivery hashes: `docs/m9-admin/SHA256.txt`  
See also: `PROGRESS.md`, `RISK.md`, `ROLLBACK.md`, `HANDOFF.md`

## What changed

Additive admin console polish on top of Phase A (login/RBAC/audit shell preserved). Per `PROGRESS.md`:

1. **Dashboard** — currency breakdown + sparklines; room treated as currency proxy (no room table).
2. **Players** — risk tags on detail; deep-links to sessions/spins/wallet.
3. **Sessions / Rounds / Spins** — filters, cross-links; spin detail shows grid/ledger.
4. **Wallet (RO)** — GET `intents/:id` + timeline modal.
5. **Ledger (RO)** — REVERSED/search/status/kind filters; health ID lists.
6. **Math (RO)** — RTP/usage list columns + detail StatCards.
7. **Reports** — DAU/MAU/retention/rankings via extended `getOpsReport`.
8. **Risk** — `HIGH_FREQ_SPIN`; honest `MULTI_DEVICE_UNAVAILABLE` (no fake fingerprint).
9. **Announcements** — draft/schedule/trilingual content JSON; existing columns only (no ALTER).
10. **System monitor** — honest probes (`SELECT 1` latency, ledgerQueryable); config `value` binding fix.
11. **i18n** — zh/en/my key parity.
12. **Responsive** — phone `@640` full-width filters, kv stack, table scroll.
13. **Tests** — extended `tests/r1-m7-admin.test.mjs` (target 19/19).
14. **Docs** — progress / risk / rollback / this review note + SHA256.

## Constraints (do not violate)

- **No git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" / push / merge / PR** unless explicitly ordered.
- **Read-only admin** for Wallet / Ledger / Math / RTP / RNG / Paytable / DB history — no core mutations outside admin read paths.
- Only game write remaining: players.status freeze/unfreeze (audited).
- Do not rewrite Phase A shell/auth/bootstrap.
- Do not add balance/round/math write APIs.

## How to verify

```bash
node --experimental-strip-types --test tests/r1-m7-admin.test.mjs
```

Expect **19/19 PASS**. Optionally re-hash listed files with PowerShell `Get-FileHash -Algorithm SHA256` and compare to `SHA256.txt`.

Manual smoke (optional): open `/admin`, login with bootstrap admin, walk modules in HANDOFF module map.

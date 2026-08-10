# ADMIN-1E Regression Report

## Suites

| Suite | Result |
|-------|--------|
| `tests/r1-m9-admin-1b.test.mjs` | PASS (10/10) |
| `tests/r1-m9-admin-1c.test.mjs` | PASS (9/9) |
| `tests/r1-m9-admin-1d.test.mjs` | PASS (8/8) |
| `tests/r1-m9-admin-1e.test.mjs` | PASS (5/5) |

Combined 1B+1C+1D: **27/27 PASS**.

## Covered modules

- ADMIN-1B: Dashboard, Players, PII, freeze/ban audit, session revoke, RBAC
- ADMIN-1C: Games, Rounds, Spins, reconciliation, RO math/RTP
- ADMIN-1D: Wallet frozenMinor, Ledger, Integrity, Deposit/Withdraw pay gate
- ADMIN-1E: Risk overview/events/workflow, Audit fields/immutability, integrity consume

## Game core

ADMIN-1E diff does not modify RNG / RTP / Math / Paytable / spin-engine core. Dirty worktree may contain pre-existing client/game files from earlier M phases — out of 1E scope; not touched for Risk/Audit delivery.

## S-18

Remains **OPEN** → ADMIN-1F (announcement publish locale secondary validation). Not closed in 1E.

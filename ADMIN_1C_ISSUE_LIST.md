# ADMIN_1C_ISSUE_LIST

| ID | Severity | Item | Disposition |
|----|----------|------|-------------|
| 1C-01 | INFO | No `games` catalog table — single official title constant | Documented · CURRENT MODEL LIMITATION |
| 1C-02 | INFO | `DISABLED` game status not persisted | Documented · not forged |
| 1C-03 | INFO | `onlinePlayers` NOT AVAILABLE (no presence) | Honest NA · sessions shown separately |
| 1C-04 | INFO | Spin ≡ Round alias (spinCount always 1) | Documented · ROUND_ALIAS |
| 1C-05 | INFO | `balance_before` not a DB column — DERIVED | Labeled in UI/API |
| 1C-06 | INFO | Spec `games.view` etc. map to existing `rounds:view` | RBAC report · no duplicate system |
| 1C-07 | WARN | Settled rounds may lack ledger reference in real data | RO anomaly + recon flag only |
| 1C-08 | INFO | Full responsive polish deferred | ADMIN-1H |
| 1C-09 | INFO | Pre-existing dirty diffs on spin/money/ledger files outside 1C scope | Not expanded · not fixed |
| 1C-10 | OPEN | S-18 announcement locales | ADMIN-1F |
| 1C-11 | OPEN | Wallet frozenMinor UI | ADMIN-1D |

No P0 blockers for ADMIN-1C acceptance.

# SECURITY REPORT (Wiring milestone)

## Fail-closed controls verified

| Control | Status |
|---|---|
| Production player identity unconfigured → 503 | PASS (existing gate) |
| REAL money `allowRealMoney: false` on spin route | PASS |
| `RealWalletAdapter` denies | PASS (unit) |
| Admin unauthenticated → 401 | PASS (r1-m7-admin) |
| Admin RBAC miss → 403 | PASS (r1-m7-admin) |
| Admin UI nav gated by permissions | PASS (additive) |
| Dangerous admin mutations require reason + audit | PASS |
| Wallet/Ledger/Math admin write endpoints absent | PASS |
| Math FROZEN immutable from admin | PASS |
| Debug `window.__game` gated | PASS |
| No secrets committed in this wiring change | PASS (`.dev.vars` pre-existing local) |

## Residual risks

1. **Test identity open locally** (`AB_ALLOW_TEST_IDENTITY=1` in `.dev.vars`) — required for playable E2E; must never ship to production hosting.
2. **Bootstrap admin password** when test identity enabled — local only.
3. **No production player IdP** — intentional until external auth wired; formal play is 503 without gate.
4. Password hashing = iterated SHA-256 (documented pre-existing); not argon2/scrypt.

## Do not

- Enable REAL money without frozen math calibration + policy sign-off.
- Expose bootstrap admin credentials outside local/dev.

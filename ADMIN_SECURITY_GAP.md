# ADMIN_SECURITY_GAP

**Phase:** ADMIN-1A  
**Date:** 2026-08-09  
**Scope:** Admin console only（《西游戏》M9）  
**Isolation rule:** 西游戏 ≠ ZRHPay（见 `.cursor/rules/product-isolation.mdc`）

---

## 1. Controls that PASS today

| Control | Evidence |
|---------|----------|
| Admin ≠ Player session | Cookie `ab_admin` / `admin_sessions` vs player identity |
| Player token cannot call Admin without admin session | `resolveAdminIdentity` 401 |
| RBAC on Admin API | `roleHasPermission` |
| Dangerous mutate needs reason + audit | `requireReason` + `admin_audit_logs` |
| No raw balance UPDATE via Admin | Documented invariant in `admin-api.ts` |
| Math/RTP/RNG not writable via Admin | RO math endpoints only |
| Deposit live confirm gated | `PROVIDER_NOT_CONFIGURED` without test identity |
| REAL money gate closed | `allowRealMoney=false` / math `realMoneyEnabled=false` |
| Bootstrap fail-closed | No seed without env/test gate |
| Phone masking in Admin list/detail | `maskPhoneAdmin` |
| Product isolation from ZRHPay Admin/Accounts | No shared admin users/DB/API in this tree |

---

## 2. Gaps (ordered)

| ID | Sev | Gap | Impact | Target phase |
|----|-----|-----|--------|--------------|
| S-01 | P0 | No rate limit / lockout on `POST /api/admin/login` | Brute force | 1H |
| S-02 | P0 | Password = iterated SHA-256 (not argon2/scrypt) | Offline crack risk if DB leaked | 1H (plan) / FUTURE harden |
| S-03 | P1 | Audit lacks Before/After/RequestId/Role columns | Incomplete forensics | 1E |
| S-04 | P1 | Session revoke permission too coarse (`system:manage`) | Privilege bleed | 1A freeze → 1B/1C |
| S-05 | P1 | Player CLOSE shares `players:freeze` | Ban/freeze duty separation weak | 1B |
| S-06 | P1 | Content publish uses `system:manage` | No CONTENT least-privilege | 1F |
| S-07 | P1 | Risk signals not persisted; no disposition audit trail | Cannot prove handling | 1E |
| S-08 | P1 | `player_auth_sessions` often absent | IP/device/risk blind spots | 1B/1E (honest empty until schema) |
| S-09 | P1 | Dashboard `api.ok`/`system.ok` always true | False healthy signal | 1B |
| S-10 | P2 | Withdraw approve/pay APIs exist while REAL gate closed | UI ops may confuse ops if misread as live payout | Docs + UI banners 1D |
| S-11 | P2 | Admin UI still emoji-heavy | Low security impact; ops clarity | 1H visual polish |
| S-12 | P2 | Search without debounce → query storms | Perf/DoS-ish | 1H |
| S-13 | P0 policy | Manual wallet adjust absent | Correct — keep **BLOCKED** | FUTURE |
| S-14 | P0 policy | Production money must stay CLOSED | Do not open in Admin-1 | ALL |
| S-15 | P1 | Worktree contains `.dev.vars` | Secret leak if commit/push | Never commit; 1H hygiene |
| S-16 | P2 | No CSRF beyond SameSite=Lax cookie | Browser CSRF residual | 1H review |
| S-17 | P2 | Support tickets missing | Social eng / ops blind | 1G |
| S-18 | P1 | Announcement `publish` API skips trilingual re-check | Draft with empty locales can be published via API | 1F |
| S-19 | P2 | Player detail shows IP/device raw (phone masked only) | **FIXED in ADMIN-1B** (server-side mask + `players:pii:view`) | DONE |

---

## 3. Explicit non-goals this phase

- Do **not** open REAL money / provider production confirm.
- Do **not** add `wallet:adjust` for “UI completeness”.
- Do **not** share Admin with ZRHPay / Accounts.
- Do **not** let Admin edit RNG/RTP/Paytable.
- Do **not** Push / Merge / Rebase / Deploy without 赵总批准.

---

## 4. Threat notes

| Threat | Current posture |
|--------|-----------------|
| Stolen player JWT → Admin | Fail (different auth) |
| Read-only admin escalates freeze | Fail if role lacks `players:freeze` |
| Ops confirms deposit in prod | Blocked by provider gate |
| Fake multi-device risk | Honest UNAVAILABLE signal |
| Cross-product data bleed | Isolation rules + no ZRHPay wiring |

---

## 5. Verdict

**Admin security baseline exists and is real, but not production-hard.**  
Critical money controls are correctly **CLOSED**.  
Highest next security engineering: **login rate limit**, **audit forensics fields**, **permission least-privilege remap**, keep **adjust BLOCKED**.

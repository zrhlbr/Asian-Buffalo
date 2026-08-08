# MODULE_IMPACT_ANALYSIS — 《西游戏 Integrated RC》→ Production RC Candidate

**Date:** 2026-08-07  
**Branch (Player):** `feature/ab-r1-m8-cursor` @ `D:\Asian-Buffalo-R1-M8-Cursor-Clean`  
**Admin twin:** `D:\Asian-Buffalo-R1-M9-Cursor-Clean` (sync Players fix only if duplicated)  
**Rules:** Dev Rules V2.0 whitelist · NO Commit / Push / Merge / Deploy · NO new large features  
**Target label:** **Production RC Candidate — Money Gate Pending** (never Production Money Ready while BR unfrozen)

---

## 1. Goal (this run ONLY)

Close Integrated RC gaps into a Production RC Candidate package:

| In scope | Out of scope |
|----------|--------------|
| P0 Admin Players live HTTP 500 → real 200 list/detail | Lobby/hub/slot/reel/animals redesign |
| P1 Hub Rankings real aggregate API + hub FE wire | Math / RTP / RNG / paytable changes |
| P2 BR-005..007 / BR-009 status honesty | Inventing Zhao production money numbers |
| P3 Money test closed-loop proof (TEMP harness) | Live PSP / real-money channels |
| P4 Device/FPS honesty (NOT TESTED if unavailable) | Fake PASS on untested devices |
| P5 Same-player full-chain E2E report | Wallet-ledger core rewrite |
| P6 i18n parity scan + tech-debt classification | `#hud` shell translateZ; removing `#gl` translateZ |
| Gates attempt + Windows script debt | Commit / push / merge / deploy |

---

## 2. Baseline (Integrated RC)

| Gap | Status entering this run |
|-----|--------------------------|
| Admin players list/detail | Live smoke **HTTP 500**; unit green (better-sqlite3) |
| Hub rankings | UI✅ empty copy · API❌ |
| BR-005..007 / BR-009 | Placeholder + fail-closed · NOT_PRODUCTION_READY |
| Money channels | TEMP test harness only |
| Real device FPS | NOT TESTED |
| Windows `pipefail` / bash scripts | Blocks `npm test` / `lint` / `build` on native PowerShell |

---

## 3. Whitelist (planned edits)

| Area | Files |
|------|--------|
| Admin Players root cause | `lib/admin/admin-queries.ts` (`runRaw` D1/better-sqlite3) · optional `admin-api.ts` error envelope |
| M9 sync (same hash twin) | Same `lib/admin/admin-queries.ts` (+ api if touched) |
| Rankings service | `lib/rankings-service.ts` **new** (aggregate Round/Win only) |
| Rankings route | `app/api/v1/game/rankings/route.ts` **new** |
| Hub FE wire | `client/xi-lobby/api.ts`, `commerce-panels.tsx`, `bdk-hub.tsx`, additive `i18n.ts` keys |
| Tests | `tests/rankings.test.mjs` **new**; extend admin coverage if needed |
| Windows script compat | `package.json` additive `*:win` scripts OR documented equivalents |
| Docs / delivery | `docs/m8-review/xi-game-v2/production-rc-candidate/**` |

### Absolute non-touch

- Lobby/hub layout/hero/entry redesign; slot reel timing; animal life cores; math/RTP/RNG
- Wallet/ledger MoneyService cores (call only; no rewrite)
- `#gl { transform: translateZ(0) }` must remain; `#hud` shell must **not** gain translateZ

---

## 4. Suspected P0 root cause (pre-fix hypothesis)

`listPlayers` / `listRounds` use `runRaw` via `db.$client.prepare(sql).all(...params)`.

| Driver | Correct API | Current behavior |
|--------|-------------|------------------|
| better-sqlite3 (unit) | `stmt.all(...params)` → `T[]` | Works → unit green |
| D1 (live `:5173`) | `stmt.bind(...params).all()` → `{ results: T[] }` | Extra args ignored / unbound `?` / non-array → `.map` throws → empty HTTP 500 |

Fits evidence: deposits/withdrawals (drizzle `db.all`) OK; audit (runRaw, often no binds, no `.map`) status 200; players list (`.map`) + detail (`listRounds` binds) both 500.

**Fix plan:** dual-driver `runRaw` (detect D1 via `$client.batch` / bind path, else better-sqlite3). No fake player rows.

---

## 5. Rankings plan (P1)

- Aggregate `game_rounds` SETTLED wins by player for `today` / `7d` / `30d`
- Return rank, masked nick, win amount minor, currency, game code, range
- Top N + offset pagination; Cache-Control short private/public policy
- Auth: same `resolveActivePlayer` gate as other game commerce GETs
- Hub modal: replace empty-only copy with live panel

---

## 6. Risk / rollback

| Risk | Mitigation |
|------|------------|
| runRaw change breaks better-sqlite3 unit | Keep sqlite path unchanged; add D1 result unwrap |
| Rankings scan cost on large rounds | LIMIT/Top N; date filter; short cache headers |
| Dual-tree drift M8/M9 | Apply identical admin-queries hash sync |
| Accidental money prod enable | Keep `productionReady: false` + fail-closed |

Rollback: revert whitelist files only; no migration down required (additive rankings route).

---

## 7. STOP conditions

- After delivery pack written under `production-rc-candidate/`
- Status label set; **no** Commit / Push / Merge / Deploy
- Money remains Gate Pending until Zhao freezes BR-005..007 / BR-009

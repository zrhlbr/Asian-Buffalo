# ACCEPTANCE_NOTE — 《西游戏》完整系统整合验收

## Label

**《西游戏 Integrated RC》** — PENDING production money rules · NOT TESTED real-device FPS · **never Production Ready**.

## Ready for Zhao review

- Steps 1–5 integrated via routes/contracts — accepted modules not rewritten
- Final routes + compat redirects verified (308)
- Same test player chain: lobby balance → hub → play spin/round/ledger → wins → VIP → deposit → withdraw → admin finance/audit
- BR-005..007 remain configurable + `NOT_PRODUCTION_READY`
- `#gl` translateZ preserved; no `#hud` shell translateZ
- Delivery pack under `docs/m8-review/xi-game-v2/integrated-rc/`
- **No Commit / Push / Merge main / Deploy**

## Explicit gaps

1. BR-005..007 / BR-009 Zhao sign-off + live PSP secrets
2. Hub rankings API incomplete (UI✅ API❌)
3. Admin players list/detail **live 500** (unit green) — needs follow-up
4. Android / iPhone / Tablet FPS **NOT TESTED**
5. `npm test` / build / lint **BLOCKED** on Windows `pipefail`; use `test:unit` (310/311; 1 pre-existing hosting.json gate)
6. Parallel M9 worktree dirty — do not dual-write

## STOP

Wait for 验收 before Commit / Push / Merge / Release.

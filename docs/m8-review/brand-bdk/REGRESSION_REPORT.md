# Brand Rename — REGRESSION REPORT

**Verdict: PASS** (static + unit; no headed visual run in this pass)

## Checks

| Gate | Result | Evidence |
|------|--------|----------|
| Whitelist-only edits | PASS | See `MODULE_IMPACT_ANALYSIS.md` ALLOWED_FILES; no Math/RTP/Wallet/Ledger/Spin/Round/CSS shell touched |
| Old brand cleared from ALLOWED_FILES | PASS | Ripgrep: no `亚洲水牛` / `Asian Buffalo` / `အာရှကြွေး` in whitelist paths |
| npm `name` unchanged | PASS | `"name": "asian-buffalo-web"` retained; only `displayName` updated |
| Symbol id `buffalo` / paytable label `水牛` | PASS (intentional keep) | `lib/game-config.ts` untouched |
| Admin i18n key parity zh/en/my | PASS | `tests/r1-m7-admin.test.mjs` → **14/14 pass**, includes `i18n dictionaries have identical, non-empty key sets` |
| Player i18n keys unchanged (values only) | PASS | Same key set; `gameTitle` / `helpIntro` values updated |
| CSS `#gl` / HUD transform shell | PASS | No CSS layout edits |
| API routes / contracts | PASS | No API path or payload-shape changes |
| Commit / push | PASS | None performed |

## Intentional leftovers (not defects)

- Code comments in `lib/math-config.ts`, `lib/server-game-engine.ts`
- Historical docs / commercial AFB quality-bar references / `.cursor/rules`
- `docs/m6-handoff/**` archival snapshots
- Test titles mentioning “Asian Buffalo” (non-UI)
- Avatar file names `ab-avatar-*.svg` (asset ids)
- Animal symbol branding (`sym_buffalo`, mark `牛`)

## Manual UI spot-check (recommended before final验收)

1. Player: logo shows 牛魔王 / BDK; browser tab “Bull Demon King · 牛魔王”
2. Help overlay intro uses new brand
3. Spin / reel / meters still functional
4. Admin login subtitle + sidebar “Bull Demon King”; locale switch zh/en/my
5. No black screen (confirm `#gl` translateZ fix still present)

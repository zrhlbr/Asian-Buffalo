# Nav UX Fix — REVIEW_PATCH

**Patch file:** `AB-XI-NAV-UX-FIX-review.patch`  
**SHA-256:** `6d33b9d3e7c37281b61ab96bbdac359b1e9eede7e10d91ff3d1e3ac9734a09a3`  
**Date:** 2026-08-07  
**Commit / push:** **NOT performed** (explicit forbid)

---

## Summary of change

Completes 《西游戏》 Layer 1–3 navigation UX:

1. **Lobby** — no back; BDK entry uses slide-left transition navigate.
2. **Hub** — visible top-left `← 返回大厅`; breadcrumb `西游戏 > 西游戏之牛魔王`; edge swipe + ESC → lobby; Start Game zoom+fade → play.
3. **Play** — `← 返回牛魔王首页` + `🏠 返回大厅` + 3-level breadcrumb; safe-leave while spinning retained; edge swipe / ESC → hub (confirm if busy); enter = opacity veil only (WebGL-safe).

Shared helpers live in `client/xi-lobby/nav.ts`.

---

## Risk / rollback

| Risk | Mitigation |
|------|------------|
| Transition buries `#gl` | Play enter never transforms `#gl` ancestors; leave uses document overlay |
| Swipe fights reel | Left-edge only; disabled when `#btn-spin.busy` |
| Mid-spin leave | Existing confirm / wait |

**Rollback:** restore whitelist files; delete `nav.ts`.

---

## Verify

```bash
node docs/m8-review/xi-game-v2/nav-ux-fix/_smoke-nav.mjs http://127.0.0.1:5173
# Expected: 13 PASS / 0 FAIL
```

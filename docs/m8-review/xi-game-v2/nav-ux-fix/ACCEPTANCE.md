# Nav UX Fix — ACCEPTANCE checklist (vs user §验收)

**Status:** Ready for Zhao review  
**Smoke:** 13 PASS / 0 FAIL  
**Commit/push:** none

| # | Acceptance item | Evidence | Status |
|---|-----------------|----------|--------|
| 1 | Layer1 `/xi` — no back button | G1; `01-lobby-no-back.png` | PASS |
| 2 | Layer2 hub — top-left `← 返回大厅` → `/xi` | G3, G5 | PASS |
| 3 | Hub breadcrumb `西游戏 > 西游戏之牛魔王` (西游戏 clickable) | G4; crumb testids | PASS |
| 4 | Layer3 play — `← 返回牛魔王首页` → hub | G7 | PASS |
| 5 | Play Home `🏠 返回大厅` → `/xi` | G8 | PASS |
| 6 | Play breadcrumb 3-level clickable | G8 chrome + G9 hub crumb | PASS |
| 7 | Explicit UI (not browser Back alone) | Buttons + crumbs + testids | PASS |
| 8 | Spin busy safe-leave confirm retained | `play-shell` confirm path unchanged in spirit | PASS (code) |
| 9 | Mobile edge swipe play→hub, hub→lobby; disabled while spin busy | `attachEdgeSwipe` + `isSpinBusy` | PASS (code; swipe not headless-asserted) |
| 10 | PC click back; ESC one level (default on); not while modal / busy without confirm | G5, G11; play ESC→`requestLeave` | PASS |
| 11 | Transitions 200–300ms (slide/zoom/fade) | `navigateXi` ms clamp; CSS | PASS (code + overlay) |
| 12 | i18n zh/my/en nav labels; 三语 chrome stays | G10; I18N.md | PASS |
| 13 | Spin path still loads `#gl`; `#hud` shell no translateZ | G6 | PASS |
| 14 | No Wallet/Reel/Spin/Math/RTP/Ledger/Admin edits | FILE_LIST whitelist | PASS |
| 15 | MODULE_IMPACT before code; delivery package complete | this folder | PASS |

---

## What was missing (pre-fix)

- Hub visible `← 返回大厅` button (CSS existed; not mounted; breadcrumb reused back testid)
- Play Home → lobby
- Play breadcrumb
- Page transition helpers
- Edge swipe + ESC one-level
- Dedicated crumb testids / nav helper module

## STOP

Delivery complete. No commit / push / Step next.

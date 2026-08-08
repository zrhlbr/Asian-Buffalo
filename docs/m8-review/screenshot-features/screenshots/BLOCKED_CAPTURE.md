# BLOCKED_CAPTURE

Headed Playwright/browser capture for Profile/VIP/Wallet overlay screenshots was not executed in this agent session (no approved interactive browser run / no local headed harness invoked).

**Fallback evidence:**
- Phase 1: `docs/m8-review/blocker-blackscreen-p0/verify.json` + headed idle/spin PNGs in that folder
- Unit tests for Profile/VIP/Rewards/Admin i18n+RBAC

Re-run capture checklist when headed env available:
1. Idle — canvas + HUD visible
2. Open Profile — avatar grid
3. Open VIP — level switcher + chests
4. Close overlays — canvas still visible (not black)
5. Spin during modal attempt — blocked toast

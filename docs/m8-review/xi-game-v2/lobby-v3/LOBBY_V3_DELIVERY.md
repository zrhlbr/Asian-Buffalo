# 《西游戏》Lobby V3 Boutique Polish — DELIVERY

**Date:** 2026-08-08  
**Scope:** `/xi` lobby only  
**Commit / push / merge / deploy:** **NO** (forbidden)

---

## Summary

Boutique polish for the XI GAME lobby: mythic black-gold look, tiered hero FX (5–8s), stronger BDK HOT glow, dimmer Coming Soon + trilingual modal, unified quick actions (≥44px), honest announcement ticker, HIGH-only wallet/VIP breath, bottom-nav safe-area polish. Hub/Play/auth/wallet business paths untouched.

---

## Visual changes

| Area | Change |
|------|--------|
| Hero | Journey art kept; sun breath + slow clouds; LOW static; MED light clouds; HIGH/ULTRA light rays + ≤6 spirit dots; cranes removed from lobby hero |
| Recommended | BDK gold HOT glow pulse (HIGH+); Coming Soon more dim; tap → Coming Soon modal only |
| Quick actions | Unified icon size/radius/stroke/hover/active/red-dot; min 44×44 |
| Announcements | Real API marquee; honest empty; 更多 opens list modal |
| Top bar | VIP/wallet subtle breath on HIGH/ULTRA only; lang class flip (no reload) |
| Bottom nav | Gold/red active polish + safe-area insets |
| Structure | Top → Hero → Announce → Rec → Quick → Bottom (no Daily Login banner) |
| Theme | Unified mythic black-gold (`xi-lobby-v3`) |

---

## Files touched (allowed only)

- `client/xi-lobby/lobby-app.tsx`
- `client/xi-lobby/lobby.css`
- `client/xi-lobby/i18n.ts`
- `client/xi-lobby/quality.ts`
- `docs/m8-review/xi-game-v2/lobby-v3/**`

## Hub / Play confirmation

**Untouched this package:** `bdk-hub.tsx`, `play-shell.tsx`, `game-host.tsx`, `game-lifecycle.ts`, `layer-keepalive.tsx`, `xi-shell.tsx`, `nav.ts`, `auth-*`, `client/m5/game/**`.

---

## Gates

| Gate | Status |
|------|--------|
| MODULE_IMPACT before code | PASS (written first) |
| i18n zh/en/my parity | PASS (`assertLobbyI18nComplete` ok, 248 keys) |
| No Daily Login banner | PASS (absent) |
| No fake jackpot winners | PASS (`jackpotDisplay: null`) |
| `#gl` translateZ / no `#hud` shell translateZ | PASS (comments + host rules preserved) |
| Screenshots / video | BLOCKED → see `BLOCKED_CAPTURE.md` |
| Code-path regression | PASS (see `REGRESSION_REPORT.md`) |
| Commit/push/merge/deploy | NOT DONE (correct) |

---

## Rollback

Revert the four `client/xi-lobby/*` files listed above; remove `docs/m8-review/xi-game-v2/lobby-v3/` if desired. No DB / API / math changes.

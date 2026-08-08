# Step 2 ONLY — 《西游戏之牛魔王》 hub `/xi/bull-demon-king` — MODULE_IMPACT_ANALYSIS

**Date:** 2026-08-07  
**Branch:** feature/ab-r1-m8-cursor  
**Rule:** Development Rules V2.0 — analyze before code; ONE MODULE (Step 2 hub). STOP after delivery for Zhao acceptance. Do **not** implement/refactor Step 3 Slot.

---

## 1. Goal (this run ONLY)

Upgrade the Step 1 stub at `/xi/bull-demon-king` into the full **Bull Demon King game hub**:

| In scope | Out of scope (STOP) |
|----------|---------------------|
| Hub page UI / CSS / i18n / nav at `/xi/bull-demon-king` | Step 3 reel/HUD/FX redesign |
| Hero (Zhao art if present; else ASSET_GAP + cinematic layered CSS) | Animal animation / Jackpot math |
| Light FX (pointer-events none; CTA clickable) | Wallet / Ledger / Session / Spin / Round core |
| Top chrome: back `/xi`, brand, avatar, VIP, MMK/USDT, messages, settings, lang | Admin core / DB history features |
| **Start Game** CTA → `/xi/bull-demon-king/play` | Fake balances / rankings / rewards |
| Feature groups 资金/会员/游戏/玩家/服务 — all clickable (modal / API / COMING_SOON) | Drive-by refactors outside whitelist |
| Minimal play **passthrough** mount of existing `GameClient` (404 prevention only) | New gameplay math / RTP / RNG |

**Acceptance after PASS:** wait for Zhao — Step 3 Slot work stays deferred beyond the minimal mount.

---

## 2. Baseline (before this package)

| Surface | Status |
|---------|--------|
| `/xi` | Full lobby (`LobbyApp`) — must not break |
| `/xi/bull-demon-king` | Step 1 stub (`BdkHubStub`) — replace with full hub |
| `/xi/bull-demon-king/play` | Empty directory — 404; needs minimal passthrough |
| `/xi/bdk` | Redirect → hub (keep) |
| Catalog `href` | Already `/xi/bull-demon-king` |
| `/` and `/game` | Existing slot — regression must PASS |
| `#gl` / `#hud` stacking | P0 — **do not touch** `client/m5/styles.css` stacking |
| Zhao BDK hero stills under `public/xi/` | **Absent** → ASSET_GAP + layered CSS |
| Hub CSS scaffolding | Already in `lobby.css` (`.xi-bdk-*`) from prior shells — reuse / extend |

---

## 3. Whitelist (planned edits)

| Area | Files |
|------|--------|
| Hub UI | `client/xi-lobby/bdk-hub.tsx` (stub → full hub) |
| Play shell (minimal) | `client/xi-lobby/play-shell.tsx` (**new**, mount only) |
| Routes | `app/xi/bull-demon-king/page.tsx`, `layout.tsx`, `play/page.tsx` (**new**) |
| CSS | `client/xi-lobby/lobby.css` (hub FX / groups / cloak / clouds; no `#gl`) |
| i18n | `client/xi-lobby/i18n.ts` (hub keys; trilingual parity) |
| API helpers (read-only) | `client/xi-lobby/api.ts` (optional VIP fetch only; no balance mutate) |
| Docs / smoke | `docs/m8-review/xi-game-v2/step-2-bdk-hub/**` |

**Allowed reuse (no redesign):** `app/game-client.tsx` / `GameClient` mount as-is; existing `/api/v1/game/profile`, `wallet/balance`, `announcements`, `vip` GET.

### 3.1 Navigation contract

```
/xi  --(BDK card)-->  /xi/bull-demon-king  --(开始游戏)-->  /xi/bull-demon-king/play
 ^                         ^                                      |
 |----(返回西游戏)---------|                                      |
                           |<----(返回牛魔王首页 / history.back)---|
```

- Hub↔lobby and hub→play use history-friendly navigation (`Link` / assign preserving back stack).
- Play shell = existing `GameClient` + thin back control. No reel/HUD/FX rewrite.
- Preserve lobby lang (`xi-lobby-lang`), do not reinit whole app on back.

---

## 4. Forbidden (must not change)

| Area | Reason |
|------|--------|
| Reel / Spin / Math / RTP / RNG | Engineering bar |
| Wallet / Ledger / Round / Settlement / Session **core** | Engineering bar |
| Admin core / DB history modules | Unrelated |
| Animal animation / Jackpot math | Slot Step 3 |
| `#gl` / `#hud` stacking CSS in `client/m5/styles.css` | Black-screen P0 |
| Commit / push / merge / deploy | Explicitly forbidden |
| African Buffalo math / paytable copy | IP + formal source rule |

---

## 5. Feature honesty policy

| Feature | Behavior |
|---------|----------|
| Deposit / Withdraw | Safe shell / pending modal — **never** client-mutate balance |
| VIP | Real GET `/api/v1/game/vip` or profile VIP if available; else honest pending |
| Balance MMK | Real GET balance; USDT = unavailable / pending contract |
| Rules / paytable / bet help | BDK / Asian Buffalo formal text only (from project formal i18n notes) |
| Rankings / records / big wins | Real data if API exists; else honest empty — no fake numbers |
| Activity / check-in / CS / mail / gifts / redeem | COMING_SOON / pending modal — clickable, not silent |

---

## 6. Risk / rollback

| Risk | Mitigation |
|------|------------|
| FX layers bury CTA | All scene layers `pointer-events: none`; CTA above z-index |
| Play double-boot / black screen | One `GameClient` per play page; destroy on unmount; no `#gl` CSS edits |
| Lobby / slot regression | Do not edit `lobby-app` flow beyond shared i18n/CSS; smoke `/xi` and `/` |
| Step 3 creep | Play shell is passthrough only — no reel redesign |
| i18n gap | `assertLobbyI18nComplete` + key parity scan |

**Rollback:** restore stub `bdk-hub.tsx` + stub page/layout; delete `play/page.tsx` + `play-shell.tsx`; revert hub-only CSS/i18n additions.

---

## 7. Verification order

1. This MODULE_IMPACT (before code)  
2. i18n keys + hub component + CSS FX  
3. Minimal play mount  
4. Build / lint (scoped) / typecheck lobby+hub  
5. Playwright gates 1–10  
6. Delivery artifacts + SHA-256  
7. STOP — ACCEPTANCE_NOTE wait for Step 3  

---

## 8. Approval to proceed

Whitelist-only Step 2 hub + minimal play passthrough. No wallet/math/admin/slot redesign. Proceed to implementation.

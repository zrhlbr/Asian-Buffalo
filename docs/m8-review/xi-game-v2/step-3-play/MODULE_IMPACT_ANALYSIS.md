# Step 3 ONLY — 《牛魔王》 formal play `/xi/bull-demon-king/play` — MODULE_IMPACT_ANALYSIS

**Date:** 2026-08-07  
**Branch:** feature/ab-r1-m8-cursor  
**Rule:** Development Rules V2.0 — analyze before code; ONE MODULE (Step 3 play). STOP after delivery. Do **not** start Step 4 (deposit / VIP admin / wallet channels).

---

## 1. Goal (this run ONLY)

Upgrade the Step 2 **minimal play passthrough** at `/xi/bull-demon-king/play` into the formal 《牛魔王》 play page shell:

| In scope | Out of scope (STOP) |
|----------|---------------------|
| Play page shell / presentation / light reel UI FX | Step 4 deposit / VIP admin / CS channels |
| Play nav (← 返回牛魔王首页 → hub) + browser/Android/iOS back | Step 1 `/xi` lobby layout/hero/entries redesign |
| Play i18n (titles + leave confirm + chrome) trilingual | Step 2 hub layout/hero/features redesign |
| Scoped play styles (`.xi-play-shell` …) | Admin / Wallet-Ledger-Math-RTP-RNG / DB history |
| HUD game-only chrome (hide hub stuffings on play) | New gameplay math / paytable values / API contracts |
| Safe leave while spinning (wait round end OR confirm) | Mock / demo RNG / local grid / local balance |
| Light mythic frame polish; animal-life amplitude (MeshBasic path) | Drive-by optimize outside whitelist |
| Win-tier **presentation** polish if safe | Changing `#hud { transform: translateZ(0) }` |

**Acceptance after PASS:** wait for Zhao — Step 4 not started.

---

## 2. Baseline (before this package)

| Surface | Status |
|---------|--------|
| `/xi` | Step 1 lobby — **must not regress**; no layout/hero/i18n/feature edits |
| `/xi/bull-demon-king` | Step 2 hub — **must not regress**; no hub layout/hero/entry edits |
| `/xi/bull-demon-king/play` | Step 2 minimal passthrough (`play-shell` + `GameClient`) |
| Formal spin chain | `bootM5` → FormalProvider Session/Spin/Round — **keep** |
| Reel timing | `NORMAL_SPIN_TOTAL_MS=6000`, stops 4.2→5.8, turbo ~2.5s — **do not break** |
| `#gl` / `#hud` stacking | `#gl { transform: translateZ(0) }`; `#hud` shell **no** translateZ — **preserve** |
| Mythic chrome | Already present on `GameClient` (`#xi-mythic-chrome`) from prior mythic package |
| Titles | zh `牛魔王`; en/my gameTitle still short `BDK` — need full brand strings |

---

## 3. Whitelist (planned edits)

| Area | Files |
|------|--------|
| Play shell | `client/xi-lobby/play-shell.tsx` (safe leave, title, lang sync, VIP light badge, confirm UI) |
| Play route | `app/xi/bull-demon-king/play/page.tsx` (Step 3 mount comment / shell only) |
| Play layout metadata | `app/xi/bull-demon-king/play/layout.tsx` (**new**, title override only) |
| Play-scoped CSS | `client/xi-lobby/lobby.css` (`.xi-play-*` only; **no** `#gl` / `#hud` shell transform) |
| Lobby i18n (additive keys) | `client/xi-lobby/i18n.ts` — **add** play leave/confirm keys only; do not change Step1/2 copy |
| Slot brand i18n | `client/m5/i18n.ts` — `gameTitle` en/my → full brand; leave-confirm keys if HUD needs them |
| HUD leave target | `client/m5/ui/hud.ts` — **minimal**: prefer hub leave href when `data-xi-play-leave` present; no spin/wallet logic |
| Animal life amplitude | `client/m5/game/symbol-life.ts` — MeshBasic-visible amplitude polish only |
| Win presentation | `client/m5/win-presentation.ts` and/or celebration CSS under play scope — presentation only |
| Docs / smoke | `docs/m8-review/xi-game-v2/step-3-play/**` |

### 3.1 Absolute-minimal Step1/2 touch (justified)

| File | Touch? | Justification |
|------|--------|---------------|
| `app/xi/page.tsx` / `lobby-app.tsx` / Step1 styles | **NO** | Forbidden |
| `app/xi/bull-demon-king/page.tsx` / `bdk-hub.tsx` / hub layout content | **NO** | Forbidden |
| `app/xi/bull-demon-king/layout.tsx` | **NO** | Hub metadata stays; play gets nested `play/layout.tsx` |
| `client/xi-lobby/i18n.ts` | **Additive keys only** | Shared dict; new `lobby.play.*` keys; existing hub/lobby strings unchanged |
| `client/xi-lobby/lobby.css` | **Additive `.xi-play-*` only** | Shared stylesheet; no `.xi-lobby-*` / `.xi-bdk-*` behavior changes |
| `client/xi-lobby/bdk-hub.tsx` Start Game href | **NO** | Already `/xi/bull-demon-king/play` |

If any accidental Step1/2 string/CSS regression appears in diff, revert that hunk before delivery.

### 3.2 Navigation contract

```
/xi  --(BDK card)-->  /xi/bull-demon-king  --(开始游戏)-->  /xi/bull-demon-king/play
 ^                         ^                                      |
 |----(返回西游戏)---------|                                      |
                           |<----(← 返回牛魔王首页 / history.back)---|
```

- Play back target = **`/xi/bull-demon-king`** (NOT `/xi`).
- Browser / Android / iOS back: play → hub (history-friendly entry from hub Start Game).
- While spinning: **wait for safe round end** OR show **trilingual confirm**; never destroy mid-settlement / double wallet.

### 3.3 HUD game-only (play surface)

Keep: back, title, Balance, Win, Bet, VIP **light badge**, Sound, Settings, Language; bottom Bet± / Auto / Turbo / Spin.

Hide on play (hub owns these): profile / wallet / help (and any recharge/withdraw/CS/activity stuffing). VIP center modal not opened from play — badge only.

### 3.4 P0 stacking (non-negotiable)

- Keep `#gl { transform: translateZ(0) }` in `client/m5/styles.css`.
- **NEVER** set `#hud { transform: translateZ(0) }` on the HUD shell.
- Play CSS must not add transform on `#hud` shell.

### 3.5 Formal spin chain

Reuse existing `GameClient` → `bootM5` → FormalProvider. No mock provider, no local RNG grid, no client balance mutation.

---

## 4. Forbidden (must not change)

| Area | Reason |
|------|--------|
| Session / Spin / Round / Wallet / Ledger / RTP / RNG / paytable **rules** | Engineering bar |
| `reel-timing.ts` stop schedule (unless already broken — verify only) | Timing contract |
| Admin modules / DB history | Unrelated |
| Step 1 lobby / Step 2 hub heroes / feature grids | Explicit forbid |
| Commit / push / merge / deploy | Explicit forbid |
| Step 4 deposit / VIP admin features | STOP after Step 3 |

---

## 5. Risk / rollback

| Risk | Mitigation |
|------|------------|
| Black screen / buried canvas | Do not touch `#hud` shell transform; verify `#gl` translateZ(0) |
| Mid-spin destroy / double wallet | Safe-leave wait OR confirm; destroy only after `!busy` |
| Step1/2 regression | Whitelist additive CSS/i18n; smoke `/xi` + hub |
| Invisible symbols after life polish | Stay on MeshBasic transform/tint/opacity path; no ShaderMaterial |
| Timing drift | Do not edit `NORMAL_*` / `TURBO_*` constants |

**Rollback:** restore Step 2 `play-shell.tsx` + `play/page.tsx`; delete `play/layout.tsx`; revert additive play CSS/i18n keys; revert m5 title/leave/life/hud minimal hunks.

---

## 6. Verification order

1. This MODULE_IMPACT (before code) — **done**  
2. Play shell + leave safety + HUD game-only CSS + i18n  
3. Title sync + lang sync lobby↔slot  
4. Light life / win presentation polish (scoped)  
5. Build / lint (scoped) / typecheck play-touched  
6. Playwright gates 1–17  
7. Delivery artifacts + SHA-256  
8. STOP — ACCEPTANCE_NOTE wait for Step 4  

---

## 7. Approval to proceed

Whitelist-only Step 3 play shell / presentation / nav / i18n / scoped styles. Formal spin chain preserved. Step1/2 untouched except additive shared keys/CSS. Proceed to implementation.

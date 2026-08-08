# 《西游戏》Visual Flagship + Mid-range Phone Fluency — MODULE_IMPACT_ANALYSIS

**Module:** Presentation / quality LOD / asset loading / renderer perf / i18n for quality settings ONLY  
**Date:** 2026-08-07  
**Rule:** Development Rules V2.0 HIGHEST — analyze → whitelist → implement → regress → deliver  
**Branch:** `feature/ab-r1-m8-cursor`  
**Scope:** AUTO quality tiers LOW / MEDIUM / HIGH / ULTRA for lobby + hub + slot FX intensity

---

## 0. Goal

Ship a single quality system that:

1. Auto-detects device capability → LOW / MEDIUM / HIGH / ULTRA
2. Degrades atmosphere before Symbol / HUD / Reel clarity
3. Keeps mid-range phones fluent (~30–45 FPS target path) while flagship can run ULTRA
4. Extends existing `client/m5/quality.ts` + Clarity V2 — does **not** rewrite Steps 1–3 structure

---

## 1. Hard bans (pre-code lock)

| Ban | Enforcement |
|-----|-------------|
| NO Math / RTP / RNG / Wallet / Ledger / Round / Settlement | Whitelist excludes `lib/game*`, money, math, admin business modules |
| NO Deposit / Withdrawal / VIP **business rules** | Settings UI strings only; commerce panels untouched for logic |
| NO break Steps 1–3 route structure | `/xi`, `/xi/bdk` (hub), play shell stay; additive quality hooks only |
| Keep `#gl { transform: translateZ(0) }` | Never remove |
| NEVER add `#hud { transform: translateZ(0) }` on shell | Preserve P0 stacking |
| NO invent binary 4K masters | Scale from existing Journey / BDK heroes only |
| NO commit / push / merge / deploy | Delivery docs + local files only |
| Trilingual i18n | New quality strings in zh-CN / my-MM / en; chrome lang toggles stay 中文\|မြန်မာ\|EN |

---

## 2. Current baseline (pre-change)

| Surface | State |
|---------|-------|
| `client/m5/quality.ts` | Tiers high/medium/low + auto; Clarity V2 DPR caps high≤3 mid≤2 low≤2; `FpsGovernor` can step up/down; `DEGRADE_ORDER` includes grass before shadows |
| Slot settings UI | Auto / High / Med / Low only — no Ultra, FX, animal, FPS target |
| Lobby / Hub | No shared quality preference; CSS particles always on (reduced-motion only) |
| Heroes | `public/xi/journey-hero.png` (682×312 PNG); `public/xi/heroes/bull-demon-king.png` (1024×768 JPEG misnamed .png); no responsive WebP/AVIF set |
| Audio | Single `AudioContext`; background dim exists; no concurrent SFX cap |
| Tests | `r1-m8-clarity-v2`, `r1-m6-presentation`, `r1-m8-clarity` assert 3-tier DPR policy |

---

## 3. Whitelist (allowed touch)

### Core quality API

| File | Change |
|------|--------|
| `client/m5/quality.ts` | Add ULTRA; device probe (memory/cores/DPR/GPU/res/FPS sample/WebGL); settings persist (mode/FX/animal/FPS); DPR caps low1.5/mid2/high2.5/ultra3; degrade order; governor step-down + hysteresis (no bounce-up) |
| `client/m5/boot.ts` | Wire new settings; FPS target; animal mode; dispose-safe path unchanged |
| `client/m5/scene/world.ts` | Apply ultra profile + fx gate; DPR helper comments; shadow/bloom/godray by profile |
| `client/m5/scene/buffalo.ts` | `setAnimMode(full\|simple)` — reduce idle frequency on LOW/simple; never kill breath |
| `client/m5/scene/particles.ts` | Budget already pooled — expose/respect tighter budgets; no churn alloc |
| `client/m5/audio.ts` | Concurrent SFX limit; suspend/pause on background; keep single context |
| `client/m5/ui/hud.ts` | Settings hooks for ultra/FX/animal/FPS |
| `client/m5/i18n.ts` | Quality Ultra + FX/animal/FPS labels (trilingual) |
| `client/m5/styles.css` | Settings row styles; LOW transition timing; **preserve** `#gl` translateZ; no `#hud` shell translateZ |
| `app/game-client.tsx` | Settings modal markup for new controls only |

### Lobby / hub presentation

| File | Change |
|------|--------|
| `client/xi-lobby/quality.ts` | **NEW** — shared preference bridge, tier CSS attr, hero src helpers, transition ms, prefetch helper |
| `client/xi-lobby/lobby-app.tsx` | Apply tier class; progressive hero; settings quality controls; particles by tier |
| `client/xi-lobby/bdk-hub.tsx` | Same; BDK hero FX intensity by tier; slot prefetch on Start |
| `client/xi-lobby/lobby.css` | Tier-scoped FX / transition / particle cuts |
| `client/xi-lobby/i18n.ts` | Quality settings strings (trilingual) |
| `client/xi-lobby/play-shell.tsx` | Safe leave only if needed for dispose/blackscreen guard — no business |

### Assets (generated from existing masters)

| Path | Action |
|------|--------|
| `public/xi/heroes/journey-*` | Scale WebP (+ optional AVIF) mobile/tablet/desktop/low from `journey-hero.png` |
| `public/xi/heroes/bdk-*` | Scale WebP (+ optional AVIF) from `bull-demon-king.png` |
| `scripts/gen-xi-hero-variants.mjs` | One-shot generator using sharp |

### Tests & docs

| Path | Action |
|------|--------|
| `tests/xi-performance-quality.test.mjs` | Tier selection, DPR caps, degrade order, persistence |
| Update `tests/r1-m8-clarity*.test.mjs`, `r1-m6-presentation.test.mjs` | Align with 4-tier DPR / governor hysteresis |
| `docs/m8-review/xi-game-v2/performance-quality/*` | Delivery pack |

---

## 4. Explicitly out of whitelist

- `lib/**` wallet / ledger / round / math / RTP / session settlement
- Admin modules / deposit-withdraw / VIP reward claim **business** logic
- `client/m5/game/reel-timing.ts`, spin duration / stop schedule
- Symbol IDs / paytable / grid
- Disposing WebGL in a way that returns black on re-enter (destroy must be route-safe; remount boots fresh World)

---

## 5. Degradation priority (locked)

```
particles → shadows → god rays → bloom → bgComplexity → renderScale(last)
```

**Never first:** Symbol plate, HUD meters, Reel sharpness.

DPR caps (device DPR × tier cap):

| Tier | Cap |
|------|-----|
| LOW | 1.5 |
| MEDIUM | 2 |
| HIGH | 2.5 |
| ULTRA | 3 |

Weak phones: auto mapping must not select ULTRA; avoid effective 3–4× DPR.

---

## 6. Default AUTO mapping (locked intent)

| Caps signal | Auto tier |
|-------------|-----------|
| Mobile + (cores≤4 or memory≤3) or weak GPU / low FPS sample | LOW |
| Mobile / small screen mid-range | MEDIUM |
| Desktop or strong phone (mem≥4, cores≥6, FPS sample≥48) | HIGH |
| Desktop flagship (mem≥8, cores≥8, WebGL2, FPS sample≥55, no weak GPU) | ULTRA |

Runtime (AUTO only): if rolling FPS **&lt; 35 for ~3.5–5s** → step HIGH→MED→LOW (and ULTRA→HIGH…). **Hysteresis: do not auto step up.**

---

## 7. Blast radius

```
quality.ts (API) ──► boot / world / buffalo / particles / audio / hud
                 ──► xi-lobby/quality.ts ──► lobby-app / bdk-hub / lobby.css
Settings DOM ──► game-client + i18n (m5 + lobby)
Assets ──► public/xi/heroes/* variants only
Tests ──► xi-performance-quality + clarity/m6 alignment
╳ money / math / admin / reel-timing
```

---

## 8. Acceptance honesty

- Unit tests: REQUIRED (tier / DPR / degrade / persist)
- Headed mid-range phone FPS: **SIMULATED ONLY** if no real device
- 30 min stability: **SIMULATED / BLOCKED** if cannot run
- Never claim **REAL DEVICE PASS** without device evidence

---

## 9. Proceed gate

Whitelist approved by this analysis → implement quality API first → wire slot → lobby/hub → assets → tests → delivery docs → STOP (no commit).

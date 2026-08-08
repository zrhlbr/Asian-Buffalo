# MODULE_IMPACT_ANALYSIS — Black Main Area P0

**Status:** Written BEFORE any code edits (Rule V1.1 Step 0).  
**Date:** 2026-08-07  
**Workspace:** `D:\Asian-Buffalo-R1-M8-Cursor-Clean`  
**Rule:** Asian Buffalo Development Rule V1.1 — HIGHEST PRIORITY

---

## 1. Task

**Symptom (P0 BLOCKER):** Game main area is BLACK; Reel / Symbols not shown; only top + bottom HUD remain. Game unusable.

**Goal:** Find TRUE root cause (not CSS-only band-aid), apply minimal surgical fix (prefer local revert of recent related change), verify full playable restore, then ONLY if stable optionally re-apply smaller species animal amplitude (Step 5).

**Frozen until fixed:** NO new FX, new anim amp (except Step 5 after full restore), clarity work, admin/M9/M10, drive-by optimize/refactor/format/global CSS churn.

---

## 2. ALLOWED_FILES whitelist

Candidates ONLY if root-cause proves need. Diff must stay minimal.

| File | Risk | When allowed |
|------|------|--------------|
| `client/m5/game/reels.ts` | Medium | Reel container / mask / opacity / renderOrder / visibility proven |
| `client/m5/game/symbol-life.ts` | Medium–High | Amplitude / material / opacity path proven to hide tiles |
| `client/m5/game/reel-timing.ts` | Low | Only if timing gates leave reel unpainted |
| `client/m5/game/symbols.ts` | Medium | Atlas / texture load path proven blank |
| `client/m5/scene/world.ts` | High | Renderer init / size 0 / dispose / composer / camera FOV proven |
| `client/m5/scene/buffalo.ts` | Medium | Only Step 5 amplitude OR if buffalo layout breaks scene |
| `client/m5/scene/particles.ts` | Low–Med | Only if particle/post path blacks viewport |
| `client/m5/styles.css` | SHARED HIGH RISK | Only if `#gl` / overlay / z-index / pointer-events stacking hides canvas; justify + minimize |
| `client/m5/ui/hud.ts` | SHARED HIGH RISK | Only if HUD DOM overlays or class toggles bury canvas |
| `client/m5/game/game.ts` | SHARED HIGH RISK | Only if bootstrap / rAF / dispose proven |
| `client/m5/boot.ts` | SHARED HIGH RISK | Only if World/Reel mount / destroy / aspect proven |
| `app/game-client.tsx` | SHARED HIGH RISK | Only if `#gl` / `#hud` mount structure proven; justify + minimize |
| `client/m5/quality.ts` | Medium | Only if soft scale / DPR / tier yields zero-size or blank GL |
| `client/m5/win-presentation.ts` | Low–Med | Only if celebration layer left covering viewport |

**ALLOWED_FILES (declared for this incident):**

```
client/m5/game/reels.ts
client/m5/game/symbol-life.ts
client/m5/game/reel-timing.ts
client/m5/game/symbols.ts
client/m5/scene/world.ts
client/m5/scene/buffalo.ts
client/m5/scene/particles.ts
client/m5/styles.css
client/m5/ui/hud.ts
client/m5/game/game.ts
client/m5/boot.ts
client/m5/quality.ts
client/m5/win-presentation.ts
app/game-client.tsx
docs/m8-review/blocker-blackscreen-p0/*
```

ACTUAL FILE_LIST after fix will be a subset with justification.

---

## 3. Forbidden modules (NO edits without Zhao approval)

- `app/api/*`
- `lib/wallet*`, ledger*, math*, spin*, round*
- `db/*`, `drizzle/*`
- `admin/*` (all admin UI/API)
- `auth/*`, session* cores
- `provider*` money/recovery cores (except read-only diagnosis of FormalGameProvider mount)
- Money / ledger / RTP / math / DB / API feature work
- Global CSS outside `client/m5/styles.css` without proven need
- New commercial FX / clarity / admin / M9 / M10 work

---

## 4. Expected impact

| Area | Expected |
|------|----------|
| Visual main viewport | Restored: background + reel frame + symbols visible |
| HUD | Unchanged behavior (top/bottom remain; clicks work) |
| Spin path | ~6s top→bottom reel motion restored |
| Wallet / session / balance | No intentional change; must remain OK |
| Math / RTP / ledger / API | Zero impact (forbidden) |
| Admin | Zero impact (forbidden) |
| Animal amplitude (Step 5) | Only after full restore; MeshBasic stay visible; smaller amp if prior amp caused black |

---

## 5. Modules that must stay OK

1. Server-authoritative Session / Spin / Round paths  
2. Wallet balance display + FormalGameProvider bootstrap  
3. Bet / Auto / Turbo / Settings / Language / Sound / Back / Paytable buttons  
4. i18n lang switch  
5. Quality mode persistence (if touched, behavior-preserving)  
6. No double create/destroy of WebGL that leaves context dead on remount  

---

## 6. Rollback point

- **No** `git reset --hard` / `git clean -fd`  
- **No** commit / merge / push  
- Rollback method: reverse the surgical diff in ACTUAL FILE_LIST only (restore prior working snippets for stacking / opacity / renderer / amplitude)  
- If fix A breaks B → stop, revert that fix, write incident note in REGRESSION_REPORT.md  

---

## 7. Root-cause checklist (Step 2 — investigate before edit)

- [x] Renderer init fail — OK when idle  
- [x] Scene unmounted / disposed — not disposed idle  
- [x] Reel container missing — 30 tiles present  
- [x] Textures fail / atlas path — maps present  
- [x] Mask / clipping — not hiding all tiles  
- [x] z-index / renderOrder — **CSS stacking implicated**  
- [x] opacity / visibility — canvas-hidden repro matches symptom  
- [x] CSS overlay covering canvas — `#hud` transform shell  
- [x] canvas size 0 — not zero  
- [x] WebGL context lost — produces white, not reported black  
- [x] Asset loader exception — no PAGEERROR  
- [x] rAF stopped — running  
- [x] Renderer double create/destroy — guarded render  
- [x] Recent `#gl` pointer-events / z-index button-fix CSS stacking — **primary**  

---

## 8. Verification checklist (Step 4)

- [x] Background visible (not solid black main)  
- [x] Reel frame visible  
- [x] Symbols visible on reels  
- [x] Buffalo visible (atmosphere OK)  
- [x] HUD top + bottom intact  
- [x] Spin ~6s, top→bottom (unit tests + busy spin probe)  
- [x] Bet / Auto / Turbo / Settings / Language / Sound / Back / Paytable  
- [x] Balance / session paths not broken by edits  
- [x] `symbol-life` + `reel-timing` tests if present  
- [x] Headed before/after screenshots or BLOCKED_CAPTURE with reason  

---

## 9. Delivery artifacts (required)

Under `docs/m8-review/blocker-blackscreen-p0/`:

1. MODULE_IMPACT_ANALYSIS.md (this file — before edits)  
2. ROOT_CAUSE_REPORT.md  
3. ALLOWED_FILES whitelist + ACTUAL FILE_LIST  
4. before/after screenshots or BLOCKED_CAPTURE  
5. Reel video or blocked  
6. BUTTON_REGRESSION.md  
7. REGRESSION_REPORT.md  
8. REVIEW_PATCH.md, SHA256.txt, git status note  
9. If Step 5 done: animal amp note + video or blocked  

---

## 10. Return contract

- Root cause one-liner  
- Files touched  
- Playable yes/no  
- Button gate pass/fail  
- Whether Step 5 done  

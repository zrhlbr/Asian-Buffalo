# Hydration + Nav Black Screen P0 — MODULE_IMPACT_ANALYSIS

**Date:** 2026-08-07  
**Branch:** feature/ab-r1-m8-cursor (working tree)  
**Rule:** Development Rules V2.0 — analyze **before** code; ONE MODULE (hydration-safe nav). STOP after delivery.  
**NO** commit / push / merge / deploy.

---

## 1. Goal (this run ONLY)

Eliminate Lobby ↔ Hub ↔ Play P0:

1. **Hydration failed** (server HTML ≠ client) on Xi route navigations  
2. **~2s stall → brief old page → ~90% black** during layer switches  
3. Restore warm nav feedback &lt;100ms click, 180–260ms opacity/transform transitions  
4. Keep `#gl { translateZ(0) }`; never add `#hud` shell `translateZ`

---

## 2. Suspected root causes (pre-code hunt targets)

| Suspect | Where | SSR≠CSR risk |
|---------|-------|--------------|
| Quality `useState(() => typeof window ? readStored : defaults)` | `lobby-app.tsx`, `bdk-hub.tsx` | First client render reads localStorage; SSR uses defaults |
| `resolveTier("auto")` during render → `detectInitialTier` / `collectDeviceCaps` | `lobby-app.tsx` (`particleN`) | Server caps (1280×720, dpr1) ≠ phone/GPU → different particle DOM count |
| Hard `window.location.assign/replace` after solid black leave overlay | `nav.ts` `navigateXi` | Full document reload; overlay `#0a080c` + cold RSC remount → black gap + re-hydrate |
| Leave overlay solid near-black | `lobby.css` `.xi-nav-leave` | Covers viewport until new document paints (~2s) |
| Layout remount / no soft router | No Xi client shell; pages are full navigations | XiLayout is pass-through; hard nav remounts everything |
| Language localStorage | `i18n.ts` via `useSyncExternalStore` | **Likely OK** if `getServerSnapshot` stays `zh-CN` (verify; optional cookie sync) |
| ProgressiveHero `hiReady` | `quality-panel.tsx` | Post-effect only — OK for hydration |
| GameClient destroy/remount | `game-client.tsx` + hard nav | Multi AudioContext / renderer risk on re-enter without singleton guard |

---

## 3. Whitelist (ALLOWED_FILES)

| File | Change |
|------|--------|
| `app/xi/layout.tsx` | Mount persistent `XiShell` (no `key={pathname}`) |
| `app/xi/loading.tsx` | **NEW** — light loading boundary (no solid black) |
| `client/xi-lobby/xi-shell.tsx` | **NEW** — soft nav registration, prefetch, transition host, FX pause class |
| `client/xi-lobby/nav.ts` | Soft router navigate; light overlay; 180–260ms; click feedback class |
| `client/xi-lobby/ui-store.ts` | **NEW** — hydration-safe quality + hydrated flag (`useSyncExternalStore`) |
| `client/xi-lobby/lobby-app.tsx` | Deterministic quality/particles first paint; soft nav only |
| `client/xi-lobby/bdk-hub.tsx` | Same quality init; soft Start→Play |
| `client/xi-lobby/play-shell.tsx` | Soft leave; no hard location; keep `#gl`/`#hud` rules |
| `client/xi-lobby/quality.ts` | Baseline tier helper; prefetch lobby/hub/play + heroes |
| `client/xi-lobby/i18n.ts` | Cookie mirror for lang (SSR-friendly); keep server snapshot deterministic |
| `client/xi-lobby/lobby.css` | Light transition overlay; `xi-nav-busy` pause FX on LOW/MED; no `#hud` translateZ |
| `app/game-client.tsx` | Single-instance boot guard; pause/resume hooks for nav |
| `client/m5/boot.ts` | Additive `pause`/`resume` on handle only (presentation lifecycle) |
| `tests/xi-hydration-nav-p0.test.mjs` | **NEW** — unit/static guards |
| `docs/m8-review/xi-game-v2/hydration-nav-p0/**` | Delivery package + E2E scripts |

### Forbidden (locked)

- Math / RTP / RNG / Spin result / Round / Settlement  
- Wallet / Ledger / Deposit / Withdrawal / VIP **business** / Admin business  
- Symbol math  
- `suppressHydrationWarning` as primary fix  
- Commit / push / merge / deploy  

---

## 4. Fix contract

1. SSR + first client render = same deterministic defaults (quality baseline, particles 0 or fixed)  
2. After hydration: `useEffect` / store sync language / quality / device tier  
3. Language: cookie mirror + shared default first frame (`zh-CN` server snapshot)  
4. Quality AUTO: baseline tier until after hydrate — never `detectInitialTier` in first paint  
5. Particles: post-hydrate init  
6. XiLayout stays mounted; only page `children` swap; no layout `key={pathname}`  
7. No black gap: keep old UI until new ready; light veil only (≤~0.35 opacity)  
8. Prefetch `/xi`, hub, play + heroes; warm nav  
9. GameClient singleton lifecycle pause/resume — no dual renderer/AudioContext  
10. Click feedback &lt;100ms; transitions 180–260ms opacity/transform only  
11. Pause heavy FX during nav on LOW/MED (`xi-nav-busy`)  
12. Shell first; wallet/VIP/rankings stay skeleton/cache — do not block shell  
13. Prefer Next `router.push` / Link over `location.href`

---

## 5. Navigation contract (unchanged layers)

```
/xi  --(soft, slide)-->  /xi/bull-demon-king  --(soft, zoom-fade)-->  /xi/bull-demon-king/play
 ^                         ^                                              |
 |-------- soft back ------|                                              |
                           |<------------- soft back / home --------------|
```

---

## 6. Acceptance probes (delivery)

| Probe | Pass |
|-------|------|
| Lobby→Hub→Play→Hub→Lobby ×20 | 0 hydration error, 0 unhandled, 0 black probe fail, 0 duplicate GameClient |
| Black probe | viewport sample 50–100ms; FAIL if main near-black &gt;150ms continuous |
| i18n | zh-CN / en / my-MM full nav |
| Mobile SIMULATED | 844×390 + CPU slowdown + Slow 4G if possible |
| Perf report | click→feedback, warm nav times |

---

## 7. Delivery package

`docs/m8-review/xi-game-v2/hydration-nav-p0/`:

HYDRATION_ROOT_CAUSE, BLACK_SCREEN_ROOT_CAUSE, NAVIGATION_PERFORMANCE_REPORT, XI_LAYOUT_LIFECYCLE, ROUTE_PREFETCH_REPORT, MOBILE_NAVIGATION_REPORT, HYDRATION_E2E_REPORT, REGRESSION_REPORT, FILE_LIST, REVIEW_PATCH, SHA256, videos A–F or BLOCKED_CAPTURE.

---

## 8. STOP

After delivery docs + local fixes: **STOP for acceptance.** No commit/push.

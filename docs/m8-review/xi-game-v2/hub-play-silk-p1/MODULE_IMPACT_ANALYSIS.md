# Hub↔Play Navigation Silkiness P1 — MODULE_IMPACT_ANALYSIS

**Date:** 2026-08-08  
**Branch:** feature/ab-r1-m8-cursor (working tree)  
**Rule:** Development Rules V2.0 — analyze **before** code; ONE MODULE (Hub↔Play WebGL lifecycle silk). STOP after delivery.  
**NO** commit / push / merge / deploy.  
**Depends on:** P0 hydration/black fixed (`hydration-nav-p0`). Lobby↔Hub ~0.5s OK — **do not redesign lobby**.

---

## 1. Goal (this run ONLY)

Fix Hub↔Play slow path caused by WebGL boot/dispose:

| Direction | Baseline (reported) | Target |
|-----------|---------------------|--------|
| Hub→Play (warm) | ~2.7s | ≤500ms (document residual if unavoidable; must beat 2.7s substantially) |
| Play→Hub (warm) | ~3.8s | ≤300–500ms — **UI first**, suspend GameClient async, **never wait full dispose** |
| Click feedback | — | ≤80ms |
| Transition | — | 200–260ms opacity/transform; keep Hub until Play ready |
| Overlay | — | If enter >150ms: light 西游戏 loading, trilingual |
| Singleton | — | Single GameClient / Renderer / Canvas / RAF / AudioContext after 20 loops |

State machine:

```
UNINITIALIZED → PRELOADING → READY → ACTIVE → SUSPENDED → DISPOSING → DISPOSED
```

No double init / resume / dispose races. Black probe from P0 stays green.

---

## 2. Suspected root causes (pre-code)

| Suspect | Where | Why slow / flash |
|---------|-------|------------------|
| Play page mounts `GameClient` inside `BdkPlayShell` | `play-shell.tsx` | Every Hub→Play = full `bootM5` (World/Three/RAF/audio) |
| Leave Play unmounts shell → `destroy()` | `game-client.tsx` cleanup | Every Play→Hub waits WebGL dispose (~seconds) before Hub feels ready |
| Prefetch only on Start click | `bdk-hub.tsx` `onStartGame` | Idle Hub does not warm boot chunk / symbols / shaders |
| `game.bootstrap()` always in `bootM5` | `boot.ts` | Cannot pre-mount WebGL without Session API |
| Pause keeps budgets; no LOW FX release | `boot.ts` pause | Suspend memory not tier-aware |
| No enter loading if boot >150ms | `nav.ts` | Cold/warm gap shows blank or old flash |
| No perf trace marks | — | Cannot prove click→ready timings |

P0 soft router + XiShell persistence already help Lobby↔Hub; **GameClient still lives under play page**, so Hub↔Play still cold-boots.

---

## 3. Whitelist (ALLOWED_FILES)

| File | Change |
|------|--------|
| `client/xi-lobby/game-lifecycle.ts` | **NEW** — state machine, perf trace, preload/activate/suspend/dispose API |
| `client/xi-lobby/game-host.tsx` | **NEW** — persistent GameClient host under XiShell |
| `client/xi-lobby/xi-shell.tsx` | Mount `XiGameHost`; layer sync → activate/suspend |
| `client/xi-lobby/play-shell.tsx` | Remove inline `GameClient`; chrome-only; keep spin-safe leave |
| `app/game-client.tsx` | Lifecycle-aware boot; no destroy on suspend path; singleton proof hooks |
| `client/m5/boot.ts` | `deferBootstrap`; pause/resume FX release; ensureBootstrap on activate |
| `client/m5/game/symbols.ts` | Export art URL list for Priority-1 prefetch (no math change) |
| `client/m5/audio.ts` | Optional lightweight warmup hook (no recreate AudioContext) |
| `client/xi-lobby/nav.ts` | Play leave → suspend async; loading overlay >150ms; perf marks; keep 200–260ms |
| `client/xi-lobby/bdk-hub.tsx` | Hub idle prefetch; Start hover/touchstart warmup (no Round/Spin) |
| `client/xi-lobby/quality.ts` | Quality-tiered preload matrix (P1 core / P2–P3 lazy) |
| `client/xi-lobby/i18n.ts` | Trilingual loading strings for overlay |
| `client/xi-lobby/lobby.css` | Host visibility; light loading overlay; no `#hud` translateZ |
| `client/m5/styles.css` | Only if `#gl` translateZ must stay verified (no `#hud` shell translateZ) |
| `tests/xi-hub-play-silk-p1.test.mjs` | **NEW** — static/lifecycle guards |
| `docs/m8-review/xi-game-v2/hub-play-silk-p1/**` | Delivery package + 20-loop E2E script |

### Forbidden (locked)

- RNG / RTP / Math / Paytable / Spin result / Round / Settlement  
- Wallet / Ledger / Deposit / Withdrawal / VIP **business** / Admin business  
- Drive-by lobby redesign / Hero / CTA / Logo freeze violations  
- First-paint device detect in ui-store  
- `#hud` shell `translateZ`; remove `#gl` translateZ  
- Commit / push / merge / deploy / DB migration  

---

## 4. Fix contract

1. **Persistent host:** GameClient mounts once under `XiShell` host; Play page is chrome + leave safety only.  
2. **Play→Hub:** UI navigate first; `suspend()` pauses RAF/audio and hides host; **no await destroy**.  
3. **Hub→Play warm:** host already READY/SUSPENDED → show + resume ≤500ms class.  
4. **Hub idle prefetch:** play route chunk + symbols + boot module + basic shader/audio warmup; P2/P3 FX lazy; quality-tiered.  
5. **Hover/touchstart:** start hidden pre-boot with `deferBootstrap` — **never** Session/Spin/Round API until ACTIVE.  
6. **Overlay:** if activate path >150ms, show light trilingual 西游戏 loading.  
7. **Transition:** 200–260ms; keep Hub visible until Play host ACTIVE.  
8. **Spin busy:** existing leave confirm / wait-then-leave unchanged.  
9. **Memory:** LOW releases heavy particle budgets on suspend; HIGH/ULTRA keep more cache.  
10. **Perf trace:** toggleable marks `routeClickAt` … `transitionEnd`.  
11. **Black probe:** P0 rules preserved (soft veil, no solid black leave).

---

## 5. Navigation contract (Hub↔Play only focus)

```
Hub  --(soft zoom-fade, warm resume)-->  Play
 ^                                        |
 |<---- soft fade-slide; suspend async ---|
```

Lobby↔Hub remains P0 path (no redesign).

---

## 6. Acceptance probes

| Probe | Pass |
|-------|------|
| Hub↔Play ×20 | avg/p50/p95/max; 0 black; 0 hydration; 0 dup GameClient/Canvas/AudioContext |
| Listener growth | no unbounded growth across 20 loops |
| Locale nav | zh-CN / en / my-MM |
| Regression | lobby / spin / wallet surfaces untouched (business) |
| Mobile | SIMULATED if no device |
| Residual vs 500ms | documented if GPU compile residual remains |

---

## 7. Delivery package

`docs/m8-review/xi-game-v2/hub-play-silk-p1/`:

GAMECLIENT_LIFECYCLE, WEBGL_STARTUP_ROOT_CAUSE, PRELOAD_ARCHITECTURE, ROUTE_PERFORMANCE_REPORT, MOBILE_MEMORY_REPORT, BUNDLE_REPORT, QUALITY_PRELOAD_MATRIX, 20_LOOP_NAV_TEST, BLACK_SCREEN_REGRESSION, I18N_REPORT, REGRESSION_REPORT, REVIEW_PATCH, SHA256, FILE_LIST, git status, videos or BLOCKED_CAPTURE.

---

## 8. STOP

After delivery docs + local fixes: **STOP for acceptance.** No commit/push.

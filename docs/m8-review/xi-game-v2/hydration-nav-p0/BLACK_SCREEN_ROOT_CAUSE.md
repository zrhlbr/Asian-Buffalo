# BLACK_SCREEN_ROOT_CAUSE

**Status:** FIXED (local; awaiting acceptance)  
**Date:** 2026-08-07

## One-liner

Hard `window.location.assign` after a **solid near-black** leave overlay (`#0a080c` @ opacity 1) tore down the document; cold reload + hydration throw left ~90% black for hundreds of ms–~2s.

## Causal chain

```
click → navigateXi leave overlay (opaque #0a080c)
     → location.assign (full document navigation)
     → blank/black paint while RSC+JS load (~2s stall feel)
     → brief flash of prior bfcache/old HTML (optional)
     → new SSR HTML + client hydrate mismatch → error overlay / stuck dark shell
```

## Contributing factors

| Factor | Role |
|--------|------|
| Solid black `.xi-nav-leave` | Covered viewport during leave + reload gap |
| Full page navigation | Destroyed React tree / XiLayout; no “keep old until ready” |
| Hydration failure | Prevented clean first paint of destination |
| GameClient remount | Extra cost on Play enter (secondary; not the void itself) |

## Fix applied

1. Soft `router.push/replace` via `XiShell` + `registerXiNavigator`  
2. Leave veil → **rgba(8,10,16,0.28)** soft overlay; exit fade keeps prior UI visible  
3. Loading boundary = thin gold bar (`app/xi/loading.tsx`), not full-screen black  
4. Hydration fix removes error-driven black traps  
5. `xi-nav-busy` pauses LOW/MED ambient FX during transition  

## Verification

Black probe (50–100ms samples, fail if near-black &gt;150ms continuous): **blackProbeFails = 0** over 20 full loops.

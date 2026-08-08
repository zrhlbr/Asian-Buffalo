# HYDRATION_ROOT_CAUSE

**Status:** FIXED (local; awaiting acceptance)  
**Date:** 2026-08-07

## One-liner

SSR HTML used quality **defaults** + **device-resolved AUTO particle counts**, while the first client render read **localStorage quality** and ran **`detectInitialTier()`**, so Lobby/Hub DOM (particle `<span>` counts / settings-derived tree) ≠ server HTML → React hydration failure on every soft/hard Xi remount.

## Evidence trail

| Check | Finding |
|-------|---------|
| `lobby-app.tsx` quality init | `useState(() => typeof window === "undefined" ? defaults : readStoredQualitySettings())` — classic SSR≠CSR |
| Render path | `resolveTier(qualitySettings.mode)` → `detectInitialTier` → `collectDeviceCaps()` during **first paint** |
| Particle DOM | `Array.from({ length: particleN })` — server caps (1280×720, dpr1) often → `high` (7 spans); phone → `medium`/`low` (4/2) |
| Language | `useSyncExternalStore` + `getLobbyLangServerSnapshot() → zh-CN` — **not** the primary mismatch |
| Progressive hero | `hiReady` only after `useEffect` — OK |
| Stack symptom | `AwaitAppRenderDependencies → XiLayout → Children → RedirectBoundary` — matches RSC remount after nav when hydrate throws |

## Fix applied

1. Shared `ui-store` with **stable** `getXiQualityServerSnapshot()` defaults  
2. `qualityHydrated === false` until post-mount sync → **particleN = 0** on SSR + first client frame  
3. After hydrate: read storage, then `resolveTier` / particles update locally  
4. Soft Next.js nav keeps XiShell mounted (fewer full remount/hydrate cycles)

## Verification

E2E Lobby→Hub→Play→Hub→Lobby ×20: **hydrationErrors = 0** (`e2e-results.json`).

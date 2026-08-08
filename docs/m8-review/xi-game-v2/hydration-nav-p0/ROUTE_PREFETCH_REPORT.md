# ROUTE_PREFETCH_REPORT

## Prefetch surfaces

| Asset / route | Mechanism |
|---------------|-----------|
| `/xi` | `router.prefetch` via `prefetchXiRoutes()` in XiShell |
| `/xi/bull-demon-king` | same |
| `/xi/bull-demon-king/play` | same + `prefetchSlotAssets()` on Hub Start |
| Journey / BDK heroes (low/mobile/desktop/fallback) | `<link rel=prefetch as=image>` via `prefetchXiNavAssets()` |
| `client/m5/boot.ts` chunk | dynamic `import()` warm on Start (existing) |

## Timing

- XiShell mount → register navigator → prefetch routes + heroes  
- Hub Start → `prefetchSlotAssets()` then soft navigate (180–220ms veil)

## Result

Warm lobby↔hub avg **~0.5s** after first visit; cold play still pays WebGL boot (see NAVIGATION_PERFORMANCE_REPORT).

# XI_LAYOUT_LIFECYCLE

## Structure

```
app/xi/layout.tsx (Server — metadata)
  └─ XiShell (client — persistent)
       ├─ registerXiNavigator(router)
       ├─ hydrateXiUiStore() once
       ├─ prefetchXiRoutes + prefetchXiNavAssets
       └─ {children}  ← page content only swaps
            /xi                  → LobbyApp
            /xi/bull-demon-king  → BdkHub
            /xi/bull-demon-king/play → BdkPlayShell → GameClient
```

## Rules enforced

| Rule | Implementation |
|------|----------------|
| Layout stays mounted | No `key={pathname}` on layout/shell |
| Soft nav | `navigateXi` → `router.push/replace` |
| Hydration-safe UI | `ui-store` server snapshots + post-hydrate sync |
| GameClient singleton | Module `activeHandle` + `__xiGameClientCount` |
| Pause during leave play | `xi-game-pause` / `xi-game-resume` events |
| `#gl` translateZ | Untouched in `client/m5/styles.css` |
| No `#hud` shell translateZ | Untouched |

## Loading

`app/xi/loading.tsx` — thin top progress bar only (never solid black fullscreen).

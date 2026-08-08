# REVIEW_PATCH.md — blackscreen P0

## Scope

Surgical presentation/CSS + render guard only. No money/math/admin.

## Diff summary

### `client/m5/styles.css`

- `#gl`: keep `z-index:0; pointer-events:none`; **add** `transform: translateZ(0)` (own compositor layer)
- `#hud`: keep `z-index:1; pointer-events:none`; **remove** Clarity-era `transform: translateZ(0)` + `backface-visibility: hidden`
- Keep explicit interactive PE selectors (`#topbar`, `#console`, modals, …)
- `#loading.done`: add `display: none !important`

### `client/m5/scene/world.ts`

```ts
render(): void {
  if (this.disposed) return;
  try {
    // composer or renderer.render as before
  } catch {
    /* Context loss / dispose race — skip frame */
  }
}
```

## Rollback

1. Restore prior `#hud { transform: translateZ(0); backface-visibility: hidden }`
2. Remove `#gl` translateZ promotion
3. Remove `#loading.done { display:none }`
4. Restore bare `World.render()` without disposed/try guard

## Not in this patch

symbol-life amplitude, reels math, API, admin, clarity feature work.

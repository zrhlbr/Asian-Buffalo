# REVIEW_PATCH

**Patch file:** `AB-XI-HYDRATION-NAV-P0-review.patch`  
**Scope:** Hydration-safe Xi nav / XiShell / soft router / GameClient singleton only  
**NO commit / push / merge / deploy** in this delivery

## Apply (local review)

```bash
git apply --check docs/m8-review/xi-game-v2/hydration-nav-p0/AB-XI-HYDRATION-NAV-P0-review.patch
git apply docs/m8-review/xi-game-v2/hydration-nav-p0/AB-XI-HYDRATION-NAV-P0-review.patch
```

## Included paths

See `FILE_LIST.md` / patch `diff --git` headers:

- `app/xi/layout.tsx`, `app/xi/loading.tsx`, `app/game-client.tsx`
- `client/xi-lobby/{xi-shell,ui-store,nav,lobby-app,bdk-hub,play-shell,quality,i18n,lobby.css}`
- `client/m5/boot.ts`
- `tests/xi-hydration-nav-p0.test.mjs`

## Acceptance stop

Delivered for human acceptance. Do not merge until hydration=0 / black=0 confirmed on target environment.

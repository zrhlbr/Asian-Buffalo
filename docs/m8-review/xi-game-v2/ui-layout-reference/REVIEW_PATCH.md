# REVIEW_PATCH — UI Layout V2 + BDK hero

**Patch file:** `AB-XI-UI-LAYOUT-V2-review.patch` (xi-lobby code diff)  
**SHA256:** see `SHA256.txt`  
**Commit/push:** **NONE** (per Development Rules V2.0)

## Summary

1. Lobby `/xi` restructured to Zhao reference module order (top chrome → Journey hero → ticker → recommended → quick → promo → bottom nav).
2. Trilingual toggles always visible (中文 / မြန်မာ / EN).
3. Hub `/xi/bull-demon-king` uses official Zhao BDK hero at `/xi/heroes/bull-demon-king.png` (`object-fit: contain`).
4. Play shell chrome only; Step3 reel/spin/math untouched.

## Regenerating patch

```bash
git diff -- client/xi-lobby/lobby-app.tsx client/xi-lobby/bdk-hub.tsx \
  client/xi-lobby/play-shell.tsx client/xi-lobby/lobby.css \
  client/xi-lobby/i18n.ts client/xi-lobby/api.ts \
  > docs/m8-review/xi-game-v2/ui-layout-reference/AB-XI-UI-LAYOUT-V2-review.patch
```

Binary assets under `public/xi/` are not in the text patch — listed in FILE_LIST + SHA256.

# REVIEW_PATCH — Mythic Visual Unification

**Module:** Presentation / visual / FX / HUD decoration / ambient audio  
**Rules:** V2.0 HIGHEST — one page at a time; no money/math; no commit

## Summary

Three-layer Journey-to-the-West brand language applied:

1. **`/xi`** — Immortal qi lobby (jade tablet, cinematic hero layers, mythic feature motifs)
2. **`/xi/bdk`** — Heaven × Flame Mountain hub with decree CTA + sparse ambient
3. **`/` + `/game`** — Edge mythic chrome + flame HUD tint + win metaphor accents; reel subject preserved

## Patch intent (not a git commit)

Generate with:

```bash
git diff -- \
  client/xi-lobby/lobby-app.tsx \
  client/xi-lobby/lobby.css \
  client/xi-lobby/i18n.ts \
  client/xi-lobby/bdk-hub.tsx \
  app/game-client.tsx \
  client/m5/styles.css \
  client/m5/win-presentation.ts \
  client/m5/scene/world.ts \
  client/m5/game/symbol-life.ts \
  client/m5/i18n.ts \
  > docs/m8-review/xi-game-v2/mythic-visual/AB-XI-MYTHIC-VISUAL-review.patch
```

## Key technical guards

- `#gl { transform: translateZ(0) }` retained
- `#hud` shell transform **not** restored
- Mythic slot chrome: `pointer-events: none`, edge masks, transparent center
- Win-presentation: particleStyle remaps only; durationMs / spin path untouched
- Symbol IDs unchanged
- Hub uses `location.assign` (no shared renderer dispose)

## New i18n keys (all zh-CN / en / my-MM)

- `lobby.hero.journey`
- `lobby.bdk.hubTag`
- `lobby.bdk.decree`
- `lobby.bdk.ambientHint`
- Slot `loading` string updated to Flame Mountain (existing key)

## Gates

See `REGRESSION_PAGE1.md` / `PAGE2` / `PAGE3`. Asset gaps in `ASSET_GAP.md`. Screenshots or `BLOCKED_CAPTURE.md`.

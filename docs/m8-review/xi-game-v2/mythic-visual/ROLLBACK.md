# ROLLBACK — Mythic Visual Unification

No commit was made for this package. To discard local mythic-visual work:

```bash
# From repo root — restore whitelist files only
git checkout -- \
  client/xi-lobby/lobby-app.tsx \
  client/xi-lobby/lobby.css \
  client/xi-lobby/i18n.ts \
  client/xi-lobby/bdk-hub.tsx \
  app/game-client.tsx \
  client/m5/styles.css \
  client/m5/win-presentation.ts \
  client/m5/scene/world.ts \
  client/m5/game/symbol-life.ts \
  client/m5/i18n.ts

# Remove delivery docs if desired
rm -rf docs/m8-review/xi-game-v2/mythic-visual
```

## Partial rollback

| Page | Restore |
|------|---------|
| 1 only | `lobby-app.tsx` hero/topbar/feat + related `lobby.css` hero/tablet/feat + `lobby.hero.journey` keys |
| 2 only | `bdk-hub.tsx` + BDK CSS block in `lobby.css` + hub i18n keys |
| 3 only | `game-client.tsx` chrome, `styles.css` mythic block, `win-presentation.ts` particleStyle, `world.ts` sky, `symbol-life.ts` comments, loading i18n |

## P0 note

If a future change reintroduces `#hud { transform: translateZ(0) }`, roll that back immediately — known black-screen cause.

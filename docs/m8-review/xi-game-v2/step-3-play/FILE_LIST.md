# Step 3 — FILE_LIST

## Whitelist code (this module)

| Path | Role |
|------|------|
| `client/xi-lobby/play-shell.tsx` | Formal play shell: back, title, VIP light badge, safe leave, lang sync |
| `app/xi/bull-demon-king/play/page.tsx` | Play route mounts shell |
| `app/xi/bull-demon-king/play/layout.tsx` | Play metadata title override |
| `client/xi-lobby/lobby.css` | Additive `.xi-play-*` only |
| `client/xi-lobby/i18n.ts` | Additive `lobby.play.*` + en play title |
| `client/m5/i18n.ts` | `gameTitle` en/my brand strings |
| `client/m5/ui/hud.ts` | Minimal leave href when `data-xi-play-leave` set |
| `client/m5/game/symbol-life.ts` | MeshBasic amplitude polish |
| `client/m5/win-presentation.ts` | Big-tier particle clarity polish |

## Intentionally unchanged (Step 1 / Step 2)

| Path | Note |
|------|------|
| `client/xi-lobby/lobby-app.tsx` | No Step 3 edits |
| `app/xi/page.tsx` / `app/xi/layout.tsx` | No Step 3 edits |
| `client/xi-lobby/bdk-hub.tsx` | No Step 3 edits |
| `app/xi/bull-demon-king/page.tsx` | No Step 3 edits |
| `app/xi/bull-demon-king/layout.tsx` | No Step 3 edits |
| `client/m5/game/reel-timing.ts` | Verified only |
| `client/m5/styles.css` `#gl`/`#hud` stacking | Untouched |
| Admin / wallet-ledger-math routes | Untouched |

## Shared additive (justify)

| Path | Diff nature |
|------|-------------|
| `client/xi-lobby/i18n.ts` | New keys + `lobby.page.bdkPlay` en → `BULL DEMON KING` |
| `client/xi-lobby/lobby.css` | New `.xi-play-*` blocks only |

## Delivery package

`docs/m8-review/xi-game-v2/step-3-play/**`

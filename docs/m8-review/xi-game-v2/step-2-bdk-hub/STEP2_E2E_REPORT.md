# Step 2 — E2E / Gate Report

**Base:** `http://127.0.0.1:5173`  
**Script:** `_smoke-step2.mjs`  
**Result:** ALL GATES PASS (see `smoke-results.json`)

| # | Gate | Result | Detail |
|---|------|--------|--------|
| 1 | `/xi` → hub | PASS | BDK card → `/xi/bull-demon-king` |
| 2 | hub → `/xi` | PASS | `xi-hub-back-lobby` |
| 3 | Start Game exists | PASS | CTA text「开始游戏」 |
| 4 | Start Game → play | PASS | `/xi/bull-demon-king/play` + `#gl` attached |
| 5 | i18n switch | PASS | zh-CN / en / my-MM title + CTA |
| 6 | no dead feature buttons | PASS | 15 feats + messages/settings/VIP → modal |
| 7 | PC / tablet / mobile | PASS | 390 / 768 / 1440 viewports |
| 8 | lobby regression | PASS | `/xi` root + BDK card |
| 9 | slot regression `/` | PASS | `#gl` + `#hud` transform `none` |
| 10 | console / rejection smoke | PASS | Fresh hub/play/root: 0 real pageerrors / rejections (vinext geist font 404 filtered as env noise, same on `/`) |

**Extra:** browser back play → hub PASS.

## Build / lint / typecheck

| Check | Result |
|-------|--------|
| `npx vite build` | PASS (includes `bdk-hub-*.js`, `play-shell-*.js`) |
| `eslint client/xi-lobby app/xi` | PASS |
| `tsc` scoped (lobby/hub) | No lobby/hub errors (pre-existing admin/worker/db noise elsewhere) |
| i18n parity `assertLobbyI18nComplete` | PASS (`missing: []`, 125 keys) |
| `git diff --check` (whitelist) | PASS |

## Capture

| Artifact | Path |
|----------|------|
| Enter / Start / Back video | `screenshots/enter-back-start-game.webm` |
| Hub zh/en/my × phone/tablet/pc | `screenshots/hub-{phone\|tablet\|pc}-{zh-CN\|en\|my-MM}.png` |
| Play / lobby / slot regression | `screenshots/04-play-zh.png`, `08-lobby-regression.png`, `09-slot-root-regression.png` |

## Step 3 confirmation

Play route is a **minimal passthrough** mounting existing `GameClient` only. No reel/HUD/FX redesign in this package.

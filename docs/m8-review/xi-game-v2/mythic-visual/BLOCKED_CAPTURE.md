# CAPTURE STATUS — Mythic Visual Screenshots

**Status:** CAPTURED (headless Playwright, 2026-08-07)

Dev server: `http://127.0.0.1:5173`  
Script: `_smoke-mythic.mjs` → all **PASS**

## Shots

| File | Route | Notes |
|------|-------|-------|
| `screenshots/01-lobby-phone.png` | `/xi` | Immortal hero + jade tablet |
| `screenshots/01b-lobby-pc.png` | `/xi` | Desktop |
| `screenshots/02-bdk-hub-phone.png` | `/xi/bdk` | Heaven / mid / flame + decree |
| `screenshots/03-slot-root.png` | `/` | Edge chrome; `#gl` matrix; `#hud` transform none |
| `screenshots/04-slot-game.png` | `/game` | Alias; stacking OK |
| `screenshots/05-lobby-zh.png` | `/xi` zh-CN | Trilingual |
| `screenshots/06-lobby-en.png` | `/xi` en | |
| `screenshots/07-lobby-my.png` | `/xi` my-MM | |

## Stacking probe (automated)

```
/  → glTransform=matrix(...), hudTransform=none, hasChrome=true
/game → same
```

This file previously reserved for BLOCKED state; capture unblocked in-session.

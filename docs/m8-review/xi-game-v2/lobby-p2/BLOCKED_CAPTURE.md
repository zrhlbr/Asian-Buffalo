# BLOCKED_CAPTURE — Lobby P2

## Status: BLOCKED

Headed browser MCP (`cursor-ide-browser`) was **not available** in this execution environment. Therefore the following evidence is **not captured** in this package:

- Screenshots: PC / tablet / 320–430
- Screenshots: 3 languages (zh / my / en)
- Videos: lobby scroll / lang switch / Hub↔Play warm nav

## Required follow-up (operator)

1. Open `/xi` on headed device or Playwright
2. Capture widths: 1440, 1080, 430, 390, 360, 320
3. Capture langs: 中文, မြန်မာ, EN (no reload)
4. Smoke Hub↔Play warm: `/xi` → `/xi/bull-demon-king` → `/xi/bull-demon-king/play` → back
5. Confirm: hydration console errors = 0; black screen = 0
6. Drop files under `docs/m8-review/xi-game-v2/lobby-p2/screenshots/` and `videos/`

## Marking

| Item | Class |
|------|-------|
| Code polish | REAL |
| Asset presence on disk | REAL |
| i18n assert | REAL |
| Screenshots / videos | BLOCKED / SIMULATED not used |

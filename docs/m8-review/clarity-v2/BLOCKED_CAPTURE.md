# BLOCKED_CAPTURE — Clarity V2 before/after screenshots

**Status:** After screenshots **not captured**. No fake before/after images invented.

## Exact blockers (2026-08-07)

1. **D1 / Miniflare instability** on local Vite (`http://127.0.0.1:5174/`): intermittent  
   `D1_ERROR: Failed to parse body as JSON, got: Error: internal error` on  
   `game_math_versions` / `players` / `game_rounds` queries →  
   `POST /api/v1/game/sessions` 500 → `[m5] bootstrap failed SyntaxError: Unexpected end of JSON input`.
2. **WebGL context loss** under Playwright/Chromium headless during HMR storms:  
   `THREE.WebGLRenderer` → `Cannot read properties of null (reading 'precision')` and shader `VALIDATE_STATUS false`.
3. Port **5173** already in use; V2 attempt bound to **5174** while another client was also hitting the same unstable D1 worker.

## How to capture (manual / CI)

```bash
cd D:\Asian-Buffalo-R1-M8-Cursor-Clean
# Ensure a healthy D1/local DB (migrate + seed math version), then:
npm run dev -- --host 127.0.0.1 --port 5173
# Separate shell, after #btn-spin is live and bootstrap succeeds:
set AB_CAPTURE_URL=http://127.0.0.1:5173/
node docs/m8-review/clarity-v2/_capture-v2.mjs
```

Outputs expected under `docs/m8-review/clarity-v2/screenshots/`:
- `after-pc-idle.png`
- `after-phone-landscape.png`
- `after-tablet-idle.png`
- plus `capture-result.json` with `world.getClarityProbe()` fields.

**Before** references (Phase3, already on disk):  
`docs/m8-review/screenshots/p3-clarity-after-pc.png` (and phone/tablet variants).

Do not treat Phase3 shots as V2 after until a successful V2 capture run.

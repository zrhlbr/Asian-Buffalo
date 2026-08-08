# MOBILE_VALIDATION — Step 5

**Policy:** Never fake PASS. Physical device absent → **NOT TESTED**.

| Device / surface | Result | Evidence |
|------------------|--------|----------|
| Android phone | **NOT TESTED** | No device attached |
| iPhone | **NOT TESTED** | No device attached |
| Tablet | **NOT TESTED** | No device attached |
| PC headed browser (Chrome channel) | **PASS (smoke)** | `_smoke-step5.mjs` @ `http://127.0.0.1:5173` |
| Lobby brand 西游戏 | PASS | smoke + `01-lobby-pc.png` |
| Deposit NOT_PRODUCTION_READY banner | PASS | smoke + `02-deposit-not-prod.png` |
| Hub navigate | PASS | `03-hub-pc.png` |
| Phone viewport headed | **NOT TESTED** | Smoke used 1280×800 only |
| Real device FPS / touch | **NOT TESTED** | — |

## Note

Port `3000` on this machine serves Open WebUI (unrelated). XI GAME vite/dev was validated on **`:5173`**.

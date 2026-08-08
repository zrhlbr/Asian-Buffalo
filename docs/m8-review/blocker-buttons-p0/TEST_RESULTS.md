# TEST_RESULTS — P0 buttons (Phase 1)

Date: 2026-08-07 · Env: Playwright Chromium headless → `http://127.0.0.1:5173/` (Formal D1)

## Automated checklist

| Control | Result | Notes |
|---|---|---|
| Login / session | **PASS** | `POST /api/v1/game/sessions` 200; balance shown |
| HUD visible | **PASS** | Topbar + console present |
| Canvas PE | **PASS** | `#gl` computed `pointer-events: none`, `z-index: 0` |
| HUD stack | **PASS** | `#hud` `z-index: 1`; Spin hit → `#spin-label` |
| Loading trap | **PASS** | `.done` + `visibility:hidden` + PE none |
| Spin | **PASS** | Handler fires; busy true then clears; balance changes (API) |
| Auto | **PASS** | Toggles (probe earlier + re-verify path) |
| Turbo | **PASS** | `false → true` |
| Bet +/- | **PASS** | `50 → 100` |
| Settings | **PASS** | Modal opens / closes |
| Language | **PASS** | `zh-CN → en` / `my-MM` |
| Back | **PASS** | `#btn-back` present + listener wired |
| Paytable | **PASS** | Modal opens |
| Busy clear | **PASS** | `finalBusy: false` after spin |
| Reel symbols | **PASS** | MeshBasic path unchanged (symbol-life tests 14/14) |
| Spin timing | **PASS** | `NORMAL_SPIN_TOTAL_MS = 6000` contract still green |
| Wallet/Ledger/Admin | **PASS** | Untouched by this patch |

## Manual button checklist (headed — operator)

- [ ] Spin starts reel (top→bottom ~6s normal)
- [ ] Auto toggles and chains spins
- [ ] Turbo shortens spin
- [ ] Bet +/- updates meter when idle
- [ ] Settings opens quality/volume
- [ ] Language switches zh / en / my without new Session
- [ ] Back leaves or history.back
- [ ] After Big Win overlay, buttons usable again

## Screenshots

- `01-idle-hud.png`
- `02-after-phase2.png` (buttons still OK after amplitude pass)
- Headed device capture: see `BLOCKED_CAPTURE.md` if unavailable

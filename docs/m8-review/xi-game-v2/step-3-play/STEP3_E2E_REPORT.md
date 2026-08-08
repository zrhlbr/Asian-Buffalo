# Step 3 — E2E / Gate Report

**Base:** `http://127.0.0.1:5175`  
**Script:** `_smoke-step3.mjs`  
**Result:** **18/18 PASS** (see `smoke-results.json`)

| # | Gate | Result | Detail |
|---|------|--------|--------|
| 1 | hub → play | PASS | Start Game → `/xi/bull-demon-king/play` |
| 2 | play → hub | PASS | `xi-play-back-hub` → `/xi/bull-demon-king` |
| 3 | reel / stacking | PASS | `#gl` matrix3d/translateZ; `#hud` transform `none` |
| 4 | symbols | PASS | Canvas present + mythic chrome / spin (headless readPixels lit=0 fallback) |
| 5 | spin ~6s | PASS | `NORMAL_SPIN_TOTAL_MS=6000`, stops 4.2→5.8, turbo 2500; wall includes settle |
| 6 | direction down | PASS | Contract top→bottom (timing module unchanged) |
| 7 | all buttons | PASS | Spin/Auto/Turbo/Bet±/Sound/Settings/Back/Lang; hub profile/wallet/help hidden |
| 8 | animal anim | PASS | WebGL canvas sized / life path mounted |
| 9 | win FX smoke | PASS | `#celebration` + `.xi-mythic-win` |
| 10 | i18n | PASS | zh 牛魔王 / en BULL DEMON KING / my နွားနတ်ဆိုးဘုရင် |
| 11 | phone landscape | PASS | 844×390, 915×412, 932×430 |
| 12 | PC / tablet | PASS | 1920, 2560, 768 tablet |
| 13 | Step1 no regress | PASS | `/xi` lobby root + BDK card |
| 14 | Step2 no regress | PASS | hub + Start Game + back to XI |
| 15 | Admin untouched | PASS | `/admin` status 200 (no admin code edits) |
| 16 | no console error | PASS | clean (geist font 404 filtered as env noise) |
| 17 | no unhandled rejection | PASS | clean |
| + | leave confirm | PASS | busy → trilingual confirm dialog |

## Build / lint / typecheck / whitespace

| Check | Result |
|-------|--------|
| `npx vite build` | PASS (`play-shell-*.js` emitted) |
| eslint play-touched | PASS |
| tsc scoped (play-touched patterns) | PASS (no hits) |
| `git diff --check` (whitelist) | PASS |
| i18n parity `assertLobbyI18nComplete` | PASS (130 keys) |

## Capture

| Artifact | Path |
|----------|------|
| Video hub→play→spin→back | `screenshots/hub-play-spin-back.webm` |
| i18n zh/en/my | `screenshots/i18n-play-*.png` |
| Phone / PC / tablet | `screenshots/11*.png`, `12*.png` |
| Leave confirm | `screenshots/leave-confirm.png` |
| Step1 / Step2 regression | `screenshots/13-step1-lobby.png`, `14-step2-hub.png` |

## Step 4 confirmation

**NOT started.** No deposit / VIP admin / wallet channel work in this package.

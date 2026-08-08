# HYDRATION_E2E_REPORT

**Script:** `_e2e-hydration-nav.mjs`  
**Base:** `http://127.0.0.1:5173`  
**Raw:** `e2e-results.json`

## Loop Lobby→Hub→Play→Hub→Lobby ×20

| Counter | Value | Target |
|---------|------:|--------|
| loopsOk | **20** | ≥20 |
| hydrationErrors | **0** | 0 |
| unhandledErrors | **0** | 0 |
| blackProbeFails | **0** | 0 |
| duplicateGameClient (`__xiGameClientCount` &gt; 1) | **0** | 0 |

**PASS**

## i18n full nav

| Locale | data-lang after toggle | OK |
|--------|------------------------|----|
| zh-CN | zh-CN | yes |
| en | en | yes |
| my-MM | my-MM | yes |

Screenshots: `screenshots/i18n-zh-CN.png`, `i18n-en.png`, `i18n-my-MM.png`

## Black probe

- Sample interval ~60ms  
- Fail if main area near-black continuously &gt;150ms  
- Observed fails: **0**

## Unit guards

`tests/xi-hydration-nav-p0.test.mjs` — 9/9 pass (plus quality regression 10/10; 19 total with performance-quality suite).

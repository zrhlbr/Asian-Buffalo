# BLOCKED_CAPTURE — Videos A–F

**Honesty:** Headed screen recordings A–F were **not** produced in this run (no headed device capture session / no Playwright `recordVideo` artifacts retained for the full ×20 loop).

## Substituted evidence (available)

| ID | Intended video | Substitute |
|----|----------------|------------|
| A | Lobby→Hub transition | E2E loop metrics + `screenshots/01-lobby.png` |
| B | Hub→Play transition | E2E hub→play avg 2746ms; play path in loop |
| C | Play→Hub leave | E2E play→hub avg 3852ms |
| D | Hub→Lobby back | E2E hub→lobby avg 568ms |
| E | i18n zh/en/my-MM nav | `screenshots/i18n-*.png` + locale PASS in `e2e-results.json` |
| F | Mobile Slow-4G cycle | `screenshots/mobile-lobby.png` + SIMULATED fullCycleMs 11988 |

## Machine-verified (stronger than silent video claims)

- hydrationErrors = 0  
- blackProbeFails = 0  
- duplicateGameClient = 0  
- loopsOk = 20  
- avgClickFeedbackMs = 4  

## Unblock path

Re-run with Playwright `recordVideo: { dir }` on a headed display, or capture OBS on physical phone, then replace this file with `VIDEO_INDEX.md` + `.webm` assets.

# Presentation Near-Miss + LDW — TEST_RESULTS

**Command:**
```bash
node --test tests/r1-m8-presentation-near-miss-ldw.test.mjs tests/r1-m8-win-presentation.test.mjs
```

**Result:** PASS — 21/21  

| Suite | Tests | Status |
|-------|-------|--------|
| `r1-m8-presentation-near-miss-ldw.test.mjs` | 10 | PASS |
| `r1-m8-win-presentation.test.mjs` | 11 | PASS |

## Coverage asserted

- `isPseudoWin` boundaries (`0`, `<bet`, `=bet`, `>bet`)
- True-miss gate + deterministic ~35% rate (200 seeds, no `Math.random(` in win-presentation)
- Stable `hashRoundSeed`
- `resolvePresentationOutcome` LDW / near-miss / jackpot ladder
- Near-miss accents from server grid only
- LOW FX scale reduction
- Game wiring + money-path freeze (static)
- Spin timing 6s contract
- Server money modules free of presentation imports
- Audio / reels / i18n trilingual `closeCall` (not toasted)

## Not run (out of scope / no headed capture this package)

- Device FPS headed recording
- Live formal spin E2E with production wallet

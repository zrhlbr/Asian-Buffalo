# TEST_RESULTS — amplitude + HUD still OK

## Unit

```
node --experimental-strip-types --test tests/r1-m8-symbol-life.test.mjs
→ 14/14 pass (incl. MeshBasic, lion-no-nod, LOD buffalo keep, NORMAL 6000ms)
```

## Post-amplitude HUD regression (same Formal session)

| Control | Result |
|---|---|
| Turbo | PASS |
| Bet + | PASS (`50→100`) |
| Settings | PASS |
| Language | PASS (`my-MM`) |
| Spin busy → clear | PASS |
| `#gl` pointer-events | `none` |

## Manual headed (operator)

- [ ] Idle: animals visibly breathe / look / accent without sync
- [ ] Lion shake/growl — no buffalo nod
- [ ] Elephant trunk raise readable
- [ ] Buffalo strongest; scene roar/charge stronger
- [ ] Buttons still clickable after watching idle ≥20s

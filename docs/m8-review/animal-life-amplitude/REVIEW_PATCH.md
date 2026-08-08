# REVIEW_PATCH — animal life amplitude

## Species intent

| Species | Continuous | Accents |
|---|---|---|
| Buffalo | Highest yaw/breath/sway | blink, ear, snort, toss, nod, mouth, lookHold, chargeHint; win=headUp |
| Lion | Mane sway strong | blink, mane shake, lookHold, mouth, nose, ear, growl — **no nod** |
| Elephant | Body sway + trunk | blink, ear, lookHold, trunkRaise |
| Zebra | Lighter toss/ears/look | blink, ear, lookHold, toss, tail |
| Antelope | Alert nod/look/ears | blink, ear, lookHold, nod, headUp |

## Safety

- Materials remain `MeshBasicMaterial`
- `lifeIntensityForSymbol` still `Math.max(1, lod)` for buffalo
- Fingerprints stay unique (tests green)

## Rollback

Revert the two files in `SHA256.txt`.

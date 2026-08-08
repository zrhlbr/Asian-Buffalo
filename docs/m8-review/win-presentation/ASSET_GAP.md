# ASSET_GAP — Win Presentation Audio / Media

## Current audio layer

`client/m5/audio.ts` is **100% procedural WebAudio** (no external binary SFX/BGM files).

All tier cues are implemented as **distinct layered procedural stacks** (different pitch sets, noise filters, timing, roar/thunder layering). Tiers do **not** share a single `bigWin()` cascade.

## Gaps vs commercial production assets

| Need | Status | Fallback in tree |
|------|--------|------------------|
| Dedicated Big/Mega/Ultra/Super/Epic/Jackpot stingers | Missing binary WAV/OGG | Distinct procedural fanfares |
| Coin drop / coin waterfall loops | Missing | `coinDrop` + procedural blips |
| Thunder / temple open | Missing | `noiseBurst` lowpass + bandpass |
| Species calls (lion/elephant/zebra/antelope/buffalo) | Soft procedural only | `animalCue` per species |
| Free-spin temple sting | Missing binary | `freeSpinEnter` layered roar + arpeggio |
| 3D Jackpot logo mesh / texture | Not authored | DOM jackpot banner + CSS ultimate chrome |
| Cinematic buffalo break-reel VFX plate | Procedural scale/smoke only | `breakReel` state + particles |

## Policy

- Do **not** invent binary audio files in this milestone.
- When licensed/original commercial SFX arrive, wire them behind the same `playCue(name)` API without changing tier math.

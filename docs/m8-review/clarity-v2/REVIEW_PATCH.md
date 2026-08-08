# M8 HD Clarity Upgrade V2 — Review Patch

**Workspace:** `D:\Asian-Buffalo-R1-M8-Cursor-Clean`  
**Status:** Complete for independent review — **NO commit / merge / push / PR**

## Summary

Raise effective visual clarity of the player game page only: sharp, dimensional, HDR-ish — without oversharpen, wash, noise, or fake 2048 detail.

## Top blur root causes (evidence)

1. **EffectComposer DPR desync** after quality/`setPixelRatio` — post buffer could stay soft  
2. **Win bloom spikes** (0.78 / 0.9) washing symbol edges  
3. **Heavy plate wash/AO/rim** softening native 1024 masters  
4. **Asset ceiling** — true masters 1024; 2048 files are upsamples  
5. **HUD glow text-shadow / drop-shadow** softening meters & celebration titles  

## Key code changes

- `quality.ts`: `PIXEL_RATIO_CAPS`, `DEGRADE_ORDER`, `renderScale`, soft-scale on low only  
- `world.ts`: `composer.setPixelRatio` on resize; bloom idle 0.20 / r0.40 / thr0.92; exposure 1.02; probe helper; setBloom cap 0.52  
- `symbols.ts`: lighter overlays; native-plate expectations; no atlas-512 force  
- `reels.ts`: `pixelAlignWorldY` / `settleSpinFrac` / 0.15s sharp restore; stretch 0.26  
- `symbol-life.ts`: reduced UV parallax/sheen; spinning fade 0..1  
- `game.ts`: FS/Ultra/Jackpot bloom 0.36 / 0.42 / 0.50  
- `styles.css`: tighter HUD/celebration shadows  
- `buffalo.ts`: catchlights, wet nose, denser horns  

## Hard bans held

No Wallet/Ledger/RTP/Math/Grid/RNG/Paytable/Session/Round/API/DB/Admin changes.  
No reel edge layout shrink. No reel direction change. Timing profile (~10s, 1.35) unchanged.

## Pack index

| Doc | Path |
|---|---|
| Audit | `CLARITY_AUDIT.md` |
| Renderer before→after | `RENDERER_CONFIG.md` |
| Textures | `TEXTURE_AUDIT.md` + `ASSET_SOURCE_LIMITATION.md` |
| Perf | `PERFORMANCE_IMPACT.md` |
| Files | `FILE_LIST.md` |
| Hashes | `SHA256.txt` |
| Tests | `TEST_RESULTS.md` (43/43 pass) |
| Screenshots | `BLOCKED_CAPTURE.md` |

## Pause-worthy risks for reviewer

1. Composer DPR sync may **increase** post RT size when LOD previously under-buffered (correctness over stale softness).  
2. Soft `renderScale=0.92` on low auto — only after tier already low; watch for rare soft frames if governor flaps.  
3. Capture blocked locally by D1/WebGL — visual sign-off still needs headed run.  
4. Buffalo horn segment↑ is tiny geo cost; confirm no low-end hitch.

# Texture Audit — Clarity V2

## Runtime loader (before → after)

| Item | Before | After |
|---|---|---|
| Source files | `client/m5/assets/symbols/*.png` 1024² | unchanged (native masters) |
| Plate `SIZE` | 1024 | **1024** (native; no fake 2048 upsample) |
| Atlas | not used | **still not forced** — 512 atlas would hurt high-DPR |
| colorSpace | SRGB | unchanged |
| generateMipmaps | true | unchanged |
| minFilter | LinearMipmapLinearFilter | unchanged |
| magFilter | LinearFilter | unchanged |
| anisotropy | min(16, GPU) | unchanged |
| imageSmoothingQuality | high | unchanged |
| Plate overlays | wash 0.10 + purple 0.03 + AO 0.28 + rim 8px | **lighter**: wash 0.05, purple 0.015, AO 0.16, rim 6px — less mush |
| 2048 review files | present as upsamples | **not loaded** — see ASSET_SOURCE_LIMITATION |

## Measured dimensions (13 symbols)

All runtime PNGs: **1024×1024**. All `*-master.png`: **1024×1024**. All `*-2048.png`: 2048×2048 file size but derived from 1024 masters per `manifest.json`.

## Atlas

| Asset | Size | Decision |
|---|---|---|
| `symbols-atlas-512.webp` | sheet 2048×2048 / tile 512 | **Do not adopt for high/mid** — would cut plate detail vs 1024 singles |
| 1024 group atlas | not present | deferred; only if packing preserves 1024 tiles without recompress |

## ASSET_SOURCE_LIMITATION

```
True artistic master resolution for all 13 official symbols is 1024×1024.
docs/m8-review/symbols/*-2048.png are upsampled deliverables, not higher-detail sources.
Clarity V2 therefore keeps runtime plates at native 1024 and invests in sampling,
DPR/composer sync, bloom restraint, and HUD sharpness — not fake 2048 VRAM spend.
Further clarity beyond ~1:1 screen mapping requires new original/licensed art ≥2048 native.
```

## Symbol clarity policy under LOD

| Tier | Symbol plate | Anisotropy | Notes |
|---|---|---|---|
| high | 1024 | full | |
| medium | 1024 | full | cut shadows/particles/godrays first |
| low | 1024 | full | bloom off; **never** force 512 atlas |

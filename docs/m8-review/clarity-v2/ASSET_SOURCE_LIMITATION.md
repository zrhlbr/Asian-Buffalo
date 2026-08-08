# ASSET_SOURCE_LIMITATION

True artistic master resolution for all **13** official symbols is **1024×1024**.

Evidence:
- `client/m5/assets/symbols/*.png` → 1024×1024 (PNG IHDR)
- `docs/m8-review/symbols/*-master.png` → 1024×1024
- `docs/m8-review/symbols/manifest.json` → `"master": "1024x1024"` for every id
- `*-2048.png` files are **upsampled** deliverables, not higher-detail sources

Clarity V2 therefore:
- Keeps runtime plates at native **1024**
- Does **not** load fake 2048 into VRAM
- Does **not** force `symbols-atlas-512` on high-DPR devices
- Invests in sampling, composer DPR sync, bloom restraint, HUD sharpness

Further clarity beyond ~1:1 screen mapping requires new **original/licensed** art at ≥2048 native (not bicubic upscales).

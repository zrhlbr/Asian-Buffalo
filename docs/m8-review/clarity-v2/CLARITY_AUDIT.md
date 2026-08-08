# M8 HD Clarity Upgrade V2 — Clarity Audit (evidence-based)

**Workspace:** `D:\Asian-Buffalo-R1-M8-Cursor-Clean`  
**Audit date:** 2026-08-07  
**Scope:** player game page presentation only (`client/m5/*`)  
**Method:** inspect live source + on-disk asset headers + Phase3 probe JSON. No guesses marked as fact.

---

## 1. Canvas CSS size

| Fact | Evidence |
|---|---|
| `#gl` is `position:absolute; inset:0; width:100%; height:100%` | `client/m5/styles.css` |
| Drawing size set from `window.innerWidth/innerHeight` with `setSize(w,h,false)` — CSS size owned by CSS, not overwritten by Three | `client/m5/scene/world.ts` `constructor` / `resize()` |
| Probe (Phase3): phone CSS 844×390, PC 1280×720, tablet 1024×768 | `docs/m8-review/perf/clarity-probe.json` |

## 2. drawingBufferWidth / Height (how computed)

| Fact | Evidence |
|---|---|
| Buffer ≈ `cssSize × renderer.getPixelRatio()` | Three `WebGLRenderer.setSize` + `setPixelRatio` |
| Probe buffers: phone **2532×1170** (844×3), PC **2560×1440** (1280×2), tablet **2048×1536** | `clarity-probe.json` |
| No custom `drawingBuffer` override found | grep `client/m5` |

## 3. devicePixelRatio usage

| Fact | Evidence |
|---|---|
| Read as `window.devicePixelRatio \|\| 1` inside `clarityPixelRatio()` | `world.ts` |
| Cap applied via quality profile `pixelRatio` | `quality.ts` + `world.ts` |

## 4. renderer.getPixelRatio / setPixelRatio policy (BEFORE V2)

| Tier | Cap | Policy |
|---|---|---|
| high | 3 | `min(max(dpr,1), 3)` |
| medium | 2 | `min(max(dpr,1), 2)` |
| low | 2 | same as medium — **never 1** |

Source: `PROFILES.*.pixelRatio` + `World.clarityPixelRatio()`.

## 5. getDrawingBufferSize

| Fact | Evidence |
|---|---|
| Not wrapped/exported before V2 | no `getDrawingBufferSize` in `client/m5` |
| Available via `renderer.getDrawingBufferSize(Vector2)` at runtime | Three API |

## 6. outputColorSpace

`THREE.SRGBColorSpace` — `world.ts` constructor.

## 7. toneMapping

`THREE.ACESFilmicToneMapping` — `world.ts`.

## 8. toneMappingExposure (BEFORE V2)

| Mode | Exposure |
|---|---|
| Idle | **1.05** |
| Free-spin mood | **1.10** |

## 9. antialias

`antialias: true` always (including low) — MSAA via browser WebGL context. No FXAA/SMAA passes.

## 10. anisotropy policy

| Fact | Evidence |
|---|---|
| `setSymbolMaxAnisotropy(renderer.capabilities.getMaxAnisotropy())` | `world.ts` |
| Clamped to `min(16, floor(gpuMax))` | `symbols.ts` `setSymbolMaxAnisotropy` |
| Applied on all cached symbol textures | `configureSymbolTexture` |

## 11. maxTextureSize

| Fact | Evidence |
|---|---|
| Not queried/stored before V2 | grep |
| GPU reports via `renderer.capabilities.maxTextureSize` | Three |
| Runtime plates are 1024² — well under typical 4096–16384 caps | `symbols.ts` `SIZE = 1024` |

## 12. Texture minFilter / magFilter

| Filter | Value |
|---|---|
| minFilter | `LinearMipmapLinearFilter` |
| magFilter | `LinearFilter` |

## 13. mipmaps

`generateMipmaps = true` on symbol textures.

## 14. Bloom params (BEFORE V2)

| Param | Idle | Free-spin | Ultra win | Jackpot |
|---|---|---|---|---|
| strength | 0.28 | 0.48 | **0.78** (`game.ts`) | **0.9** |
| radius | 0.55 | (unchanged) | — | — |
| threshold | 0.88 | (unchanged) | — | — |
| enabled | high/medium; **off** on low | | | |

Constructor: `UnrealBloomPass(size, strength, radius=0.55, threshold=0.88)`.

## 15. FXAA / SMAA / MSAA state

| AA | State |
|---|---|
| MSAA | **on** (`antialias: true`) |
| FXAA | **not used** |
| SMAA | **not used** |

## 16. Render Scale / dynamic resolution (BEFORE V2)

| Fact | Evidence |
|---|---|
| **No** `renderScale` field on `QualityProfile` | `quality.ts` |
| Auto LOD = whole-tier drop via `FpsGovernor` | `quality.ts` / `boot.ts` |
| EffectComposer `setSize(w,h)` called on resize **without** `composer.setPixelRatio(...)` | `world.ts` `resize()` |
| Three `EffectComposer.setSize` uses internal `_pixelRatio` and does **not** re-read renderer DPR | `node_modules/three/.../EffectComposer.js` |

**Blur risk:** after `applyQuality` changes DPR, composer targets can stay at the previous DPR → soft/upscaled post path.

## 17. Symbol actual texture dimensions (13 official)

Runtime assets under `client/m5/assets/symbols/` (PNG headers measured 2026-08-07):

| Symbol | Runtime PNG | WebP companion |
|---|---|---|
| buffalo | **1024×1024** | 512×512 |
| lion | **1024×1024** | 512×512 |
| elephant | **1024×1024** | 512×512 |
| antelope | **1024×1024** | 512×512 |
| zebra | **1024×1024** | 512×512 |
| wild | **1024×1024** | 512×512 |
| scatter | **1024×1024** | 512×512 |
| a | **1024×1024** | 512×512 |
| k | **1024×1024** | 512×512 |
| q | **1024×1024** | 512×512 |
| j | **1024×1024** | 512×512 |
| ten | **1024×1024** | 512×512 |
| nine | **1024×1024** | 512×512 |

Review masters (`docs/m8-review/symbols/*-master.png`): all **1024×1024**.  
`*-2048.png` files exist but are **upsampled** from 1024 masters (manifest `"master": "1024x1024"`). Atlas `symbols-atlas-512.webp` is **2048×2048** sheet with 512 tiles — **not** wired into runtime loader.

Runtime plate: `SIZE = 1024` canvas; art drawn with wash + AO + rim overlays.

## 18. Reel display pixel size

| Fact | Evidence |
|---|---|
| Cell world size `CELL = 1.12`, gap `0.02`, 5×4 grid | `reels.ts` |
| Commercial scale `scaleFactor` ≈ **1.94** (phone 844×390), **1.95** (PC), **1.46** (tablet) | `clarity-probe.json` |
| On-screen cell ≈ `1.12 * scaleFactor` world units projected through FOV/cameraZ | derived |
| Phone buffer 2532×1170 @ DPR3 → symbols sample ~hundreds of px across when full-bleed | probe + math |
| Spin uses Y `speedStretch` up to **+34%** while cruising | `reels.ts` `layout()` |
| Final stop sets `frac = 0` after bounce; **no** explicit screen-pixel snap helper before V2 | `reels.ts` |

## 19. HUD font rendering approach

| Fact | Evidence |
|---|---|
| DOM HUD over canvas (`#hud`), not MSDF/bitmap in WebGL | `styles.css`, `hud.ts` |
| Fonts: Cinzel + Noto Sans SC + Noto Sans Myanmar (Google CSS import) | `styles.css` |
| `-webkit-font-smoothing: antialiased`, `text-rendering: geometricPrecision` | Phase3 |
| Softening risks: `text-shadow` glow on meters (`0 0 10px`), celebration `drop-shadow` / large glow, `backdrop-filter: blur` on glass/modal, non-1 scales during bump/tierIn animations | `styles.css` |

## 20. High / Mid / Low quality presets (BEFORE V2)

| | high | medium | low |
|---|---|---|---|
| pixelRatio cap | 3 | 2 | 2 |
| grass | 9000 | 2500 | 600 |
| furShells | 8 | 4 | 0 |
| bloom | on | on | **off** |
| godRays | on | off | off |
| DOF | **off** | off | off |
| groundFog | on | on | off |
| shadows | 2048 | 1024 | off / 512 map |
| coin / particles | 220 / 400 | 140 / 220 | 70 / 100 |
| symbolAnimIntensity | 2 | 1 | 1 |
| renderScale | *(absent → 1)* | *(absent)* | *(absent)* |

Degradation today = whole-tier drop (high→medium→low). Order of cuts roughly particles/grass/shadows/godrays/bloom, but **not** encoded as an explicit ladder; **render scale never used**.

---

## Identified real blur sources (ranked)

1. **EffectComposer DPR desync** — `composer.setSize` without `setPixelRatio` after quality/DPR change → post buffer can be lower than drawing buffer (soft bloom path).
2. **Win bloom spikes** — Ultra 0.78 / Jackpot 0.9 wash symbol edges (esp. buffalo face) on top of radius 0.55.
3. **Symbol plate overlays** — even at native 1024, warm wash + bottom AO + rim redraw softens microcontrast vs raw master.
4. **Asset source ceiling** — true masters are 1024; `*-2048.png` are upsamples (no real extra detail). On DPR3 phones, cells are large → limited by source, not only DPR.
5. **Spin Y-stretch + animal UV parallax** — intentional motion softeness; if settle is slow/incomplete, stop frames can feel mushy (stretch already clears on stop; life UV resumes immediately).
6. **HUD glow shadows / drop-shadows** — large `text-shadow` / `filter: drop-shadow` on meters and celebration titles.
7. **No render-scale-last policy encoded** — auto path jumps tiers; cannot shed particles before touching resolution explicitly.

**Ruled out / already fixed in Phase3:** plate forced to 512; low DPR=1; DOF on reels; FXAA stack; CSS letterboxing of `#gl`.

---

## Hard bans confirmed untouched by this audit

Wallet / Ledger / RTP / Math / Grid / RNG / Paytable / Session / Round / Settlement / formal API / Provider / Recovery / Database / Admin — not in presentation path above.

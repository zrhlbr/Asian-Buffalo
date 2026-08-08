# FILE_LIST — blocker symbols missing + 6s timing

## Fixed / verified (presentation only)

| File | Role |
|---|---|
| `client/m5/game/symbol-life.ts` | **FIX** — tile material back to MeshBasicMaterial; life API retained |
| `client/m5/game/reels.ts` | **FIX** — `SymbolTileMaterial` typing; spinAll comment clarifies 6s shared profile |
| `client/m5/game/reel-timing.ts` | **VERIFIED** — already `NORMAL_SPIN_TOTAL_MS=6000`, stops `[4200…5800]`, turbo 2500, `SPIN_SPEED_MULT=1.35` |
| `tests/r1-m8-reel-timing.test.mjs` | **UPDATE** — FS/auto share profile assertion |

## Not touched

Wallet / Ledger / Math / RTP / RNG / Admin / Session / Round / Spin API / Provider / Recovery / DB.

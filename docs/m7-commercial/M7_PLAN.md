# R1-M7 Commercial Upgrade Plan

**Worktree:** `D:\Asian-Buffalo-R1-M7-Cursor-Clean`  
**Branch:** `feature/ab-r1-m7-cursor`  
**Baseline:** `9654d41` + M6 presentation foundation  
**Reference bar:** African Buffalo commercial mobile (see `reference/`)  
**Kimi admin archive:** `kimi-admin-readonly/` (read-only)

## Dual acceptance standard

1. **Engineering:** server-authoritative Session/Spin/Round/Wallet/Ledger/RTP/API/DB, trilingual, multi-device, tests, security — never broken by visuals.  
2. **Commercial:** UI / art / animation / mobile UX must reach or exceed African Buffalo commercial mobile quality.

## Principles

- No new math / wallet / ledger / RTP / API contract changes for gameplay.  
- Mobile-first landscape layout (African Buffalo pattern).  
- Formal SymbolIds unchanged; art only upgrades presentation.  
- Single frontend `client/m5` (now commercial skin).  
- Admin is ops surface; fail-closed auth; no Mock as default path.

## Phases

| Phase | Focus |
|---|---|
| A | Commercial HUD (top/bottom) + mobile layout |
| B | Reel metal frame + bounce/glow |
| C | Commercial symbol illustrations (canvas/GPU textures) |
| D | Scene / buffalo / win FX polish |
| E | Admin console (adopt Kimi admin after audit) |
| F | Capture + tests + Review Patch (no Commit) |

## Palette (Asian Buffalo commercial — not a clone of African red casino)

- Metal gold `#F0D078` / deep bronze `#5A3A12`  
- Jade accent `#2F8F6B` (Asian identity)  
- Glass panels `rgba(18,10,4,.82)` with specular highlights  
- Keep savanna 3D world; HUD becomes commercial metal/glass overlay  

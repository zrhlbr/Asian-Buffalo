# ACCEPTANCE_NOTE — Production RC Candidate

## Label

**Production RC Candidate — Money Gate Pending**

Never **Production Money Ready** while BR-005..007 / BR-009 remain unfrozen.

## Ready for Zhao review

- P0 Admin Players live 500 → **fixed** (D1 `runRaw` dual-driver); list+detail 200 in full-chain smoke
- P1 Hub Rankings API + FE **wired** (aggregate Round wins; privacy mask; cache; tests)
- P2 BR-005..009 documented **NOT_PRODUCTION_READY** (no invented Zhao values)
- P3 Money TEST closed loop proven (unit + live TEMP harness)
- P4 Device/FPS honesty: mobile **NOT TESTED**; PC stills only
- P5 Same-player E2E **28/28** + rankings probe 200
- P6 i18n parity scan + tech-debt A–E; Windows `*:win` scripts
- `#gl` translateZ kept; `#hud` shell no translateZ
- Delivery under `docs/m8-review/xi-game-v2/production-rc-candidate/`
- **No Commit / Push / Merge / Deploy** performed

## Explicit remaining gates for Money Ready

1. Zhao freeze BR-005 / BR-006 / BR-007 / BR-009 + live PSP secrets  
2. Real Android / iPhone / Tablet headed FPS evidence  
3. Resolve or consciously accept `hosting.json` unit gate drift  

## STOP

Wait for 验收. Do not Commit / Push / Merge main / Deploy from this agent run.

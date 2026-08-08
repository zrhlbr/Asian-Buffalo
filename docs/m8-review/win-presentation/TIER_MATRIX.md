# M8 Win Presentation — Tier Matrix

Presentation only. Thresholds never alter Wallet / Ledger / RTP / Math / Settlement.

## Multiplier bands (× total bet)

| Tier | Threshold | Rank |
|------|-----------|------|
| Big | ≥ 10× | 7 |
| Mega | ≥ 25× | 8 |
| Ultra | ≥ 50× | 9 |
| **Super** (NEW) | ≥ 70× | 10 |
| **Epic** (NEW) | ≥ 85× | 11 |
| Jackpot | ≥ 100× | 12 |

## Line / grid tiers (below Big when multiplier &lt; 10×, or when higher than line alone)

| Tier | Trigger | Rank |
|------|---------|------|
| Normal | max line count ≥ 3 | 1 |
| Medium | max line count ≥ 4 | 2 |
| Strong | max line count ≥ 5 | 3 |
| Fullscreen common | zebra/antelope cells ≥ 10 | 4 |
| Fullscreen high | lion/elephant cells ≥ 10 | 5 |
| Fullscreen buffalo | buffalo cells ≥ 10 (~8–12s) | 6 |

Resolver takes the **highest** applicable tier from multiplier / line / fullscreen signals.

## Choreography summary

| Tier | Buffalo | Audio (primary) | Particles | Camera | HUD |
|------|---------|-----------------|-----------|--------|-----|
| Normal | — | winNormal + coinDrop | small burst | light shake | meter flash |
| Medium | lowRoar | winMedium | gold ring / more coins | light push | flash |
| Strong | headUp | winStrong + thunder | gold-purple beams | ground shake | flash 2 |
| FS common | lookAtWin | fullscreenCommon + species | wash + pillars | push | flash 2 |
| FS high | lookAtWin | fullscreenHigh + species | coin rain + beams | shake | flash 2 |
| FS buffalo | charge | fullscreenBuffalo + thunder | waterfall + divine | continuous push | all-gold flash |
| Big | bigWin | bigWin | coins + pillars | zoom | overlay |
| Mega | run | megaWin | 1.45× rain + spotlight darken | zoom | overlay |
| Ultra | jumpOut | ultraWin | multi-layer + divine wash | strong shake | overlay |
| Super | slowWalk | superWin | giant coins + temple | slow-mo push | all-gold overlay |
| Epic | standRoar | epicWin + thunder | gold-purple energy + lightning | slow-mo | all-gold overlay |
| Jackpot | breakReel | jackpot | ultimate waterfall | cinematic | jackpot banner |
| Free Spin enter | roar | freeSpinEnter | temple beams | push | toast + FS mood |

## Free Spin enter

Triggered when `awardedFreeGames > 0`. Independent of win ladder. Sets free-spin grassland tint / bloom / pillars.

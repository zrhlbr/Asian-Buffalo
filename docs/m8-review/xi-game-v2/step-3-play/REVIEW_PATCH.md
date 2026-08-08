# Step 3 — REVIEW PATCH 《牛魔王》 play `/xi/bull-demon-king/play`

## Summary

1. Upgraded Step 2 minimal passthrough into formal play shell (title chip, ← back to hub, VIP light badge, HUD game-only hiding).
2. Safe leave while spinning: wait for round end OR trilingual confirm — never destroy mid-settlement.
3. Titles synced: 牛魔王 / BULL DEMON KING / my-MM; lobby↔slot lang sync.
4. Light animal-life amplitude + Big-win particle clarity polish (presentation only).
5. Preserved formal Session/Spin/Round chain and `#gl` translateZ(0) / no `#hud` shell transform.

## Navigation

```
/xi → /xi/bull-demon-king → /xi/bull-demon-king/play
                              ↑ back / history ←──┘
```

Back target is **hub**, not lobby.

## P0 status

| Item | Status |
|------|--------|
| Background / mythic chrome | Present (`#xi-mythic-chrome`) |
| Reel frame / edge fill | Present; phone landscape verified |
| Symbols | Canvas mounted; life MeshBasic path |
| HUD meters + Spin/Bet/Auto/Turbo/Settings/Lang/Sound | Present |
| Hub stuffings on play | Hidden (profile/wallet/help) |
| `#gl` translateZ(0) | Preserved |
| `#hud` shell transform | `none` |
| Formal spin (no mock RNG) | Preserved |

## Rollback

Restore Step 2 `play-shell.tsx` + `play/page.tsx`; delete `play/layout.tsx`; revert additive `.xi-play-*` CSS / `lobby.play.*` keys / m5 title+hud+life+win hunks.

## Forbidden confirmed

No Admin / Wallet-Ledger-Math-RTP-RNG / DB history / Step 4 deposit-VIP work. No commit / push / merge.

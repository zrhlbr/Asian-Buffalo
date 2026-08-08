# Lobby V3 — REVIEW_PATCH

**Patch file:** `AB-XI-LOBBY-V3-review.patch`  
**SHA256:** see `SHA256.txt`

## Intent

Boutique polish for `/xi` lobby presentation only.

## Diff summary

### `client/xi-lobby/lobby-app.tsx`
- Root class `xi-lobby-v3` + `data-xi-lobby-v3`
- Hero: sun breath layer; spirit-dots only (cranes removed)
- VIP / wallet breath class hooks
- Coming Soon modal wrapper + testid

### `client/xi-lobby/lobby.css`
- Tier FX rewrite: LOW static / MED light clouds / HIGH+ rays
- V3 black-gold theme block
- HOT glow, Coming Soon dimmer, quick-action unify, ticker/nav/safe-area
- HIGH-only VIP/wallet breath; reduced-motion / FX-off gates
- Ornament glyph fix (`◆`)

### `client/xi-lobby/quality.ts`
- `particleCountForTier`: 0 / 0 / 4 / 6 (low/med/high/ultra)

### `client/xi-lobby/i18n.ts`
- `lobby.comingSoon.toast` zh/en/my

## Out of patch

Hub/Play/auth/nav keep-alive/game lifecycle/m5 game — **zero lines**.

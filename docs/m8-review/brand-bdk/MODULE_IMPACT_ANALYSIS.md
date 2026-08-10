# Brand Rename — MODULE IMPACT ANALYSIS (Bull Demon King / 牛魔王 / BDK)

**Rule:** Asian Buffalo Development Rule V1.1 — HIGHEST PRIORITY  
**Date:** 2026-08-07  
**Scope:** User-visible product brand chrome only. No Math/RTP/Wallet/Ledger/Spin/Round/API path/CSS shell changes.  
**Workspaces:**  
- `D:\Asian-Buffalo-R1-M8-Cursor-Clean` (player + shared)  
- `D:\Asian-Buffalo-R1-M9-Cursor-Clean` (admin sync)

Canonical full analysis also in M8 `docs/m8-review/brand-bdk/MODULE_IMPACT_ANALYSIS.md`.

## Brand mapping (user-visible)

| Locale | Old | New |
|--------|-----|-----|
| zh-CN | 亚洲水牛 / Asian Buffalo | **牛魔王** |
| en | Asian Buffalo / ASIAN BUFFALO | **Bull Demon King** |
| my-MM | အာရှကြွေး / Asian Buffalo | **Bull Demon King** (no standard MY brand) |
| short | — | **BDK** (compact HUD) |

## M9 ALLOWED_FILES (edited)

- `lib/admin/i18n.ts`
- `app/admin/layout.tsx`
- `app/admin/admin-app.tsx`
- `app/layout.tsx`
- `client/m5/i18n.ts`
- `app/game-client.tsx`
- `package.json` (`displayName` only)

## Out of scope leftovers

npm `name`, routes, DB, env keys, math/wallet/ledger/spin, CSS shell, animal symbol `buffalo`, historical docs, code comments.

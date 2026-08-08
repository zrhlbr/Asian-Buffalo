# Brand Rename — MODULE IMPACT ANALYSIS (Bull Demon King / 牛魔王 / BDK)

**Rule:** Asian Buffalo Development Rule V1.1 — HIGHEST PRIORITY  
**Date:** 2026-08-07  
**Scope:** User-visible product brand chrome only. No Math/RTP/Wallet/Ledger/Spin/Round/API path/CSS shell changes.  
**Workspaces:**  
- `D:\Asian-Buffalo-R1-M8-Cursor-Clean` (player + shared)  
- `D:\Asian-Buffalo-R1-M9-Cursor-Clean` (admin sync)

## Brand mapping (user-visible)

| Locale | Old | New |
|--------|-----|-----|
| zh-CN | 亚洲水牛 / Asian Buffalo | **牛魔王** |
| en | Asian Buffalo / ASIAN BUFFALO | **Bull Demon King** |
| my-MM | အာရှကြွေး / Asian Buffalo | **Bull Demon King** (see MY note) |
| short | — | **BDK** (PWA / compact) |

### Myanmar (my) brand choice

No established Myanmar brand for 牛魔王. **Decision:** keep English product name **Bull Demon King** (and **BDK** where short) in `my-MM` / admin `my` dictionaries for brand keys. Do not invent a literal MY calque. Animal symbol labels (`sym_buffalo` / `水牛` / `ကြွေး`) remain game content, not product brand.

## ALLOWED_FILES whitelist (edit only these)

### M8 — player + shared

| File | Why |
|------|-----|
| `client/m5/i18n.ts` | `gameTitle`, `helpIntro` zh/en/my |
| `app/layout.tsx` | browser title / SEO description |
| `app/game-client.tsx` | logo aria-label + fallback logo/help text |
| `app/admin/layout.tsx` | admin browser title |
| `app/admin/admin-app.tsx` | sidebar brand title (user-visible) |
| `lib/admin/i18n.ts` | `common.appName`, `login.subtitle` zh/en/my |
| `package.json` | `displayName` only (NOT `name`) |
| `public/avatars/ab-avatar-*.svg` (×16) | `aria-label` accessibility brand text |

### M9 — admin sync (same relative paths)

| File | Why |
|------|-----|
| `lib/admin/i18n.ts` | admin product strings |
| `app/admin/layout.tsx` | admin title |
| `app/admin/admin-app.tsx` | sidebar brand |
| `app/layout.tsx` | if present / shared metadata |
| `client/m5/i18n.ts` | parity if player shell present |
| `app/game-client.tsx` | parity if present |
| `package.json` | `displayName` only |
| `public/avatars/ab-avatar-*.svg` | if present |

## Explicitly OUT of scope (intentional leftovers)

| Item | Reason |
|------|--------|
| `package.json` → `"name": "asian-buffalo-web"` | npm package id — forbidden |
| Folder / git remote / wrangler worker names | infra identifiers |
| API route paths `/api/...` | contracts |
| DB tables, env var **keys** | infra |
| Symbol id `buffalo`, asset filenames `buffalo.webp` | game content IDs |
| `lib/game-config.ts` symbol `label: "水牛"` | animal symbol label, not product brand |
| `sym_buffalo` i18n values (水牛 / Buffalo / ကြွေး) | paytable animal name |
| CSS comments (`styles.css` header) | not user-visible |
| Code comments (`math-config.ts`, `server-game-engine.ts`) | not user-visible |
| Historical docs (`docs/00…`, commercial AFB bar, `.cursor/rules`) | not UI; AFB remains quality-bar reference |
| `docs/m6-handoff/**`, patches, snapshots | archival |
| Test **names** mentioning Asian Buffalo | not user-visible; assertions use `asb-prototype` / avatar ids |
| CSS layout / `#gl` / HUD transform | black-screen risk — untouched |
| Math / Wallet / Ledger / Spin / Round / RTP | forbidden |

## Risk & regression gates

1. After edits, ripgrep should find **no** user-visible whitelist leftovers of `亚洲水牛` / `Asian Buffalo` in ALLOWED_FILES.  
2. Reel / Spin / buttons / symbol ids unchanged.  
3. Admin login subtitle + sidebar brand show BDK names in zh/en/my.  
4. i18n key parity preserved (same keys; values only).  
5. No commit / merge / push.

## Delivery artifacts (this folder)

- `MODULE_IMPACT_ANALYSIS.md` (this file)  
- `FILE_LIST.txt`  
- `BEFORE_AFTER.md`  
- `REGRESSION_REPORT.md`  
- `REVIEW_PATCH.md`  
- `SHA256SUMS.txt`  
- `GIT_STATUS_NOTE.md`

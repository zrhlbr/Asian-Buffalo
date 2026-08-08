# Brand Rename — BEFORE / AFTER string samples

## Player i18n (`client/m5/i18n.ts`)

| Key | Locale | Before | After |
|-----|--------|--------|-------|
| gameTitle | zh-CN | 亚洲水牛 | 牛魔王 |
| gameTitle | en | Asian Buffalo | BDK *(compact HUD)* |
| gameTitle | my-MM | အာရှကြွေး | BDK *(no standard MY brand; short code)* |
| helpIntro | zh-CN | 亚洲水牛正式规则与客服入口… | 牛魔王正式规则与客服入口… |
| helpIntro | en | Asian Buffalo formal rules… | Bull Demon King formal rules… |
| helpIntro | my-MM | Asian Buffalo တရားဝင်… | Bull Demon King တရားဝင်… |

## Browser / SEO (`app/layout.tsx`)

| Field | Before | After |
|-------|--------|-------|
| title | Asian Buffalo · 亚洲水牛 | Bull Demon King · 牛魔王 |
| description | Asian Buffalo 5×4、50线… | Bull Demon King（牛魔王）5×4、50线… |

## HUD fallback (`app/game-client.tsx`)

| Surface | Before | After |
|---------|--------|-------|
| logo aria-label | Asian Buffalo | Bull Demon King |
| logo-text fallback | 亚洲水牛 | 牛魔王 |
| helpIntro fallback (M8) | 亚洲水牛正式规则… | 牛魔王正式规则… |

## Admin

| Surface | Before | After |
|---------|--------|-------|
| `app/admin/layout.tsx` title | Asian Buffalo · Admin Console | Bull Demon King · Admin Console |
| sidebar brand | 🐃 Asian Buffalo | 🐃 Bull Demon King |
| zh `common.appName` | 亚洲水牛 · 运营后台 | 牛魔王 · 运营后台 |
| en `common.appName` | Asian Buffalo · Admin | Bull Demon King · Admin |
| my `common.appName` | Asian Buffalo · Admin | Bull Demon King · Admin |
| zh `login.subtitle` | 亚洲水牛 R1-M9 运营管理后台 | 牛魔王 R1-M9 运营管理后台 |
| en `login.subtitle` | Asian Buffalo R1-M9 Operations Console | Bull Demon King R1-M9 Operations Console |
| my `login.subtitle` | Asian Buffalo R1-M9 စီမံခန့်ခွဲမှု Console | Bull Demon King R1-M9 စီမံခန့်ခွဲမှု Console |

## PWA / displayName (`package.json`)

| Field | Before | After | Note |
|-------|--------|-------|------|
| displayName | Asian Buffalo Web Game | Bull Demon King | user-visible |
| name | asian-buffalo-web | asian-buffalo-web | **unchanged** (npm id) |

## Avatars (`public/avatars/ab-avatar-*.svg` ×16, M8 only)

| Before | After |
|--------|-------|
| aria-label="Asian Buffalo avatar A*" | aria-label="Bull Demon King avatar A*" |

## Myanmar brand policy

Keep **Bull Demon King** / **BDK** in `my` dictionaries for product brand keys (no invented Myanmar calque). Animal symbol `sym_buffalo` / `ကြွေး` unchanged.

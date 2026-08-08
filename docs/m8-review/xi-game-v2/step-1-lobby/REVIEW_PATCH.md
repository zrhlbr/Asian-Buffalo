# Step 1 Lobby — REVIEW_PATCH

**Patch file:** `AB-XI-STEP1-LOBBY-review.patch` (git diff of whitelist paths)

**Scope:** `/xi` full lobby polish + real next-route **stub** only.

**Includes:**

- Full lobby layout (topbar, mythic hero, features, catalog, bottom nav, modals)
- Journey cinematic CSS hero + ASSET_GAP label
- 牛魔王 card → `/xi/bull-demon-king` (stub: title + 验收后开发 + back)
- Trilingual lobby i18n (zh-CN / en / my-MM)
- Legacy `/xi/bdk` → stub redirect
- Slot stacking left untouched

**Excludes / rolled back from prior overbuild:**

- Full hub feature grid / Start Game CTA / ambient FX
- `/xi/bull-demon-king/play` (404 — Step 2 NOT started)
- Wallet/Ledger/Math/Spin/Admin changes

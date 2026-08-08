# 《西游戏》V2 Routing P0 — MODULE_IMPACT_ANALYSIS

**Module:** XI three-tier routing / shell / navigation only  
**Date:** 2026-08-07  
**Rule:** Development Rules V2.0 HIGHEST — analyze before code; one concern; no math/wallet/admin core.

---

## 1. Goal

Make these routes **real and click-testable**:

| Tier | Route | Title | Role |
|------|-------|--------|------|
| 1 Lobby | `/xi` | 西游戏 | Full platform lobby (not a shell stub) |
| 2 Hub | `/xi/bull-demon-king` | 西游戏之牛魔王 | Dedicated BDK hub — **not** the slot |
| 3 Play | `/xi/bull-demon-king/play` | 牛魔王 | Existing reel/spin GameClient |

Plus:

- Legacy redirect `/xi/bdk` → `/xi/bull-demon-king` (301/replace)
- Enter/back chains: lobby ↔ hub ↔ play
- Browser / Android back: play → hub → lobby; no intentional black-screen path
- Independent layouts + correct document titles
- Hub holds feature entries (recharge/VIP/rules/…); slot stays gameplay-only

**FAIL** if any of the three routes or the click chain is missing.

---

## 2. Current baseline (before this package)

| Surface | Route | Gap vs Zhao P0 |
|---------|-------|----------------|
| Lobby | `/xi` → `LobbyApp` | Exists (full lobby) — keep |
| Hub stub | `/xi/bdk` → `BdkHub` | Wrong path; CTA opens `/game` or `/` not dedicated play URL |
| Play alias | `/` and `/game` → `GameClient` | Regression OK; **primary** play URL missing |
| Catalog | `lib/lobby-catalog.ts` `href: "/xi/bdk"` | Must point at hub only (not play) |
| Journey / BDK HD stills | Not under `public/xi/` | ASSET_GAP — procedural CSS heroes remain |

P0 canvas stacking (`#gl { transform: translateZ(0) }`, no `#hud` shell `translateZ`) in `client/m5/styles.css` — **do not touch**.

---

## 3. In-scope whitelist

| Area | Files (planned) |
|------|-----------------|
| App routes / layouts | `app/xi/**`, `app/xi/bull-demon-king/**`, legacy `app/xi/bdk/page.tsx`, `next.config.ts` redirects |
| Lobby / hub / play shells | `client/xi-lobby/lobby-app.tsx` (href via catalog only), `bdk-hub.tsx`, new `play-shell.tsx`, `lobby.css`, `i18n.ts` |
| Catalog href | `lib/lobby-catalog.ts` (navigation string only) |
| Shared mount | Reuse `app/game-client.tsx` / `GameClient` — **no** spin/math rewrite |
| Docs / smoke | `docs/m8-review/xi-game-v2/routing-p0/*` |

### 3.1 Navigation contract

```
/xi  --(BDK card)-->  /xi/bull-demon-king  --(开始游戏)-->  /xi/bull-demon-king/play
 ^                         ^                                      |
 |----(返回西游戏)---------|                                      |
                           |<----(返回牛魔王首页 / history.back)---|
```

- Prefer history-friendly navigation (`Link` / `router.push`) so browser back matches the chain.
- Play shell mounts the **same** `GameClient` as `/` and `/game` (single boot/destroy lifecycle; no double-init).

---

## 4. Out of scope (must not change)

| Area | Reason |
|------|--------|
| Wallet / Ledger / Session / Spin / Round / RTP / RNG / Settlement | Engineering bar |
| `client/m5/game/*` reel math, symbols, timing | Slot integrity |
| `#gl` / `#hud` stacking CSS | Black-screen P0 |
| Admin CMS core | Unrelated module |
| Commit / push / merge / deploy | Explicitly forbidden this task |

Optional tiny touch: `GameClient` props for leave href **only if** required for back label — prefer overlay in `play-shell` to avoid `client/m5` edits.

---

## 5. Risk / rollback

| Risk | Mitigation |
|------|------------|
| Wrong card target opens slot | Catalog `href` = hub only; E2E asserts URL |
| Double WebGL / black screen | One `GameClient` mount per play page; destroy on unmount |
| Legacy links break | 301/replace `/xi/bdk` → hub |
| i18n gaps | Trilingual keys for titles / start / back |

**Rollback:** delete `app/xi/bull-demon-king/**`, restore catalog href + `bdk` page, revert `next.config` redirect, restore hub CTA to prior `/game`.

---

## 6. Verification order (one concern)

1. Impact doc (this file) — done before code  
2. Routes + redirects + layouts  
3. Hub CTA / feature grid / lobby catalog href  
4. Play shell + back to hub  
5. E2E scenarios 1–7 + zh/en/my title keys  
6. Delivery artifacts + SHA256  

---

## 7. Approval to proceed

Whitelist-only routing/shell/nav. No wallet/math/admin edits. Proceed to implementation.

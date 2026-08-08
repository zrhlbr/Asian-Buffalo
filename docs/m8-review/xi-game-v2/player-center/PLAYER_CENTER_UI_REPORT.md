# Player Center UI Report

**Theme:** Mythic black-gold (`--pc-ink` / `--pc-gold` / panel glass) consistent with lobby mythic tokens; scoped under `.xi-pc*` only.

## Sections

| Block | UI | Behavior |
|-------|-----|----------|
| Identity hero | Avatar ring, nick, UID, VIP pill | Avatar/nick → profile modal; VIP → VIP modal |
| Wallet card | MMK + USDT columns + total | MMK from real balance; USDT honest unavailable unless `usdtSupported`; total = MMK only (no fake USDT sum) |
| Wallet shortcuts | 4-up (2-col ≤430) | Deposit / withdraw modals; ledger / records local sheets |
| Activity group | List rows ≥44px | Live panels or Coming Soon badge |
| Account group | Security / lang / CS / help / about | Security shell + reserved badges; lang instant toggle |
| Logout | Full-width CTA | `authLogout` when session; else login/register |

## Honesty

- Loading / error / unavailable strings from i18n — no invented balances or jackpots.  
- Security reserved rows are non-interactive badges — no fake device/login logs.  
- Coupons / CS marked Coming Soon.

## Perf / hydration

- Me tab mounts only when `nav === "me"` (home hero not painted on Me).  
- Wallet snapshot fetched after Me paint; parent profile/balance reused.  
- Lang via existing `useSyncExternalStore` store — no reload.

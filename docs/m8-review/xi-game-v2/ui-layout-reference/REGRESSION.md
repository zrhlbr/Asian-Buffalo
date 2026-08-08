# REGRESSION — UI Layout V2 + BDK hero

**Smoke:** `_smoke-layout.mjs` @ `http://localhost:5174` — **21/21 PASS** (prior run)

| Check | Result |
|-------|--------|
| Lobby sections present + order | PASS |
| Lang switch + persist | PASS |
| Hub Start Game → play | PASS |
| Play `#gl` present / visible | PASS |
| `#gl { transform: translateZ(0) }` still in `client/m5/styles.css` | PASS (source lines 46–47) |
| Play back → hub | PASS |
| No Reel/Spin/Wallet/Ledger/Math edits | PASS (whitelist only) |
| BDK hero img wired | PASS — `/xi/heroes/bull-demon-king.png` |
| Hub ASSET_GAP badge gone | PASS |

## Screenshots

| File | Content |
|------|---------|
| `screenshots/00-reference.png` | Zhao lobby layout reference |
| `screenshots/01-lobby-phone-before.png` | Prior lobby |
| `screenshots/01-lobby-phone-after.png` | Layout V2 lobby |
| `screenshots/02-hub-phone-before.png` | Prior hub (CSS figure) |
| `screenshots/02-hub-phone-after.png` | Hub with official BDK art (refresh) |
| `screenshots/03-play-after.png` | Play shell regression |
| `screenshots/04-lobby-tablet-after.png` | Tablet |
| `screenshots/05-lobby-pc-after.png` | PC |

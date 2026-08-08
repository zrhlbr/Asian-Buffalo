# RISK — XI GAME V2 Phase 1

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | Lobby replaces `/` and breaks slot entry | High | `/` unchanged; lobby only at `/xi`; `/game` is additive alias |
| R2 | Touching `#hud { transform }` reintroduces black screen | High | Zero edits to `client/m5/styles.css` stacking; unit asserts `#gl translateZ` / no shell `#hud translateZ` |
| R3 | Fake balances shown as truth | Medium | Fail-closed loading/error; USDT shows unavailable pending multi-currency contract |
| R4 | Dead feature buttons | Medium | Every feature opens modal with i18n pending copy |
| R5 | Coming-soon games 404 | Low | Cards open coming-soon modal; no href |
| R6 | Admin catalog drift | Low | Static seed + CONTRACT; admin authoring deferred to later sync |
| R7 | `vinext start` without CF env throws on identity bridge | Pre-existing | Dev smoke uses `vite` + `.dev.vars`; prod path unchanged by lobby |
| R8 | Local D1 flakiness under load | Pre-existing | Lobby page itself is client/static catalog; APIs fail-closed |

## Phase boundary

Phase 2 (BDK hero home) and Phase 3 (slot commercial changes) **not started**.

# R1-M5 Integration — File List

Baseline: `4049348f4b7673694de16e4ef55fd306c5b390c8`  
Branch: `feature/ab-r1-m5-integration`  
Status: **uncommitted** (no merge/push)

## Added — M5 client (Prototype visuals migrated in-tree)

| Path | Role |
|---|---|
| `client/m5/boot.ts` | Formal Three.js boot (FormalGameProvider only) |
| `client/m5/formal-provider.ts` | Session/Spin/Round/Rules/Balance client |
| `client/m5/adapter.ts` | Presentation types, bet presets, UI winTier |
| `client/m5/mock-provider.ts` | Isolated mock — not on formal boot path |
| `client/m5/adapter.legacy-mock.ts` | Quarantined Prototype mock (reference) |
| `client/m5/audio.ts` | SFX |
| `client/m5/i18n.ts` | zh-CN / en / my-MM |
| `client/m5/styles.css` | HUD / scene CSS |
| `client/m5/game/game.ts` | Presentation orchestrator |
| `client/m5/game/reels.ts` | 5×4 reel rig |
| `client/m5/game/symbols.ts` | Formal SymbolId painters |
| `client/m5/scene/world.ts` | 3D world |
| `client/m5/scene/buffalo.ts` | Buffalo animation |
| `client/m5/scene/particles.ts` | Particles |
| `client/m5/ui/hud.ts` | HUD + formal paytable display |

## Added — DEV/TEST wiring (fail-closed in prod)

| Path | Role |
|---|---|
| `lib/runtime-identity.ts` | `DevTestIdentityProvider` + gate |
| `lib/dev-test-bootstrap.ts` | Seed player + TEST wallet credit |
| `lib/dev-schema-bootstrap.ts` | Local empty-D1 schema bootstrap |
| `lib/route-test-services.ts` | Shared TEST wallet/round store |
| `app/api/v1/game/wallet/balance/route.ts` | Balance read for HUD |
| `tests/r1-m5-integration.test.mjs` | Integration guards |

## Modified

| Path | Change |
|---|---|
| `app/game-client.tsx` | Replace demo grid client with M5 shell |
| `app/page.tsx` / `app/layout.tsx` / `app/globals.css` | Host M5 UI |
| `app/api/v1/game/sessions/route.ts` | Runtime identity + DEV bootstrap |
| `app/api/v1/game/spins/route.ts` | Shared TEST wallet + runtime identity |
| `app/api/v1/game/rounds/[roundId]/route.ts` | Runtime identity |
| `lib/api-handlers.ts` | Export `resolvePlayerForBalance` |
| `worker/index.ts` | Bridge Worker vars → `process.env` |
| `vite.config.ts` | D1 migrations_dir + local TEST vars |
| `.openai/hosting.json` | `d1: "DB"` |
| `package.json` | add `three`, Windows-safe scripts |
| `tests/identity.test.mjs` | Allow runtime identity factory |

## Deliverables

| Path |
|---|
| `docs/m5-integration/AB-K1-R1-M5-review.patch` |
| `docs/m5-integration/SHA256SUMS.txt` |
| `docs/m5-integration/FILE_LIST.md` |
| `docs/m5-integration/TEST_REPORT.md` |
| `docs/m5-integration/RISK_REPORT.md` |
| `docs/m5-integration/ROLLBACK.md` |
| `docs/m5-integration/screenshots/pc-en-spin.png` |
| `docs/m5-integration/screenshots/tablet-en.png` |
| `docs/m5-integration/screenshots/tablet-zh-CN.png` |
| `docs/m5-integration/screenshots/mobile-my-MM.png` |

## Intentionally untouched (frozen)

- `lib/server-game-engine.ts`, `lib/math-config.ts`, paytable constants source of truth
- `lib/money-service.ts`, `lib/db-ledger.ts`, `lib/wallet-intent.ts`, `lib/wallet-provider.ts`
- `drizzle/*.sql` migration files
- Prototype directory `C:\Users\zhaor\Documents\kimi\workspace\asian-buffalo-m5` (read-only source)

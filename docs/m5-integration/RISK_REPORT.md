# R1-M5 Integration — Risk Report

## Critical controls (verified intent)

| Control | Status |
|---|---|
| No MockProvider on formal boot path | OK — `client/m5/boot.ts` imports `FormalGameProvider` only |
| No client RNG / local pay evaluation on formal path | OK — outcomes from `/api/v1/game/spins` |
| Big/Mega/Ultra/Jackpot UI-only | OK — `winTier` only in presentation; not in wallet/ledger/math |
| Production identity fail-closed | OK — gate requires `AB_ALLOW_TEST_IDENTITY=1` |
| M1–M4 frozen math/wallet/ledger/migrations not rewritten | OK — integration adds wiring + presentation only |
| Single frontend (no Prototype runtime dependency) | OK — assets under `client/m5/` |

## Residual risks

1. **Local wallet is `TestWalletAdapter` (in-memory)**  
   Spins settle through the same orchestrator/math path, but balance is process-local TEST adapter, not durable D1 ledger postings. Formal money layer (`MoneyService`/`DbWalletAdapter`) is unused by routes in this milestone.  
   **Mitigation:** Wire `DbWalletAdapter` + recovery in a later approved milestone without changing M4 implementations.

2. **DEV schema bootstrap** (`lib/dev-schema-bootstrap.ts`)  
   Local Miniflare D1 did not auto-apply drizzle migrations; DEV gate runs `CREATE TABLE IF NOT EXISTS`. Production must not set `AB_ALLOW_TEST_IDENTITY`.  
   **Mitigation:** Keep gate fail-closed; prefer real migration apply in deploy pipelines.

3. **Symbol art remapping**  
   Formal SymbolIds are used (`lion`/`elephant`/…/`nine`), but some canvas painters reuse Prototype tiger/deer/lotus artwork. Presentation-only; paytable/math use formal ids.  
   **Mitigation:** Replace painters with dedicated formal art later.

4. **`three` dependency**  
   Added `three@0.166.1` (copied from Prototype node_modules when npm rebuild failed on `better-sqlite3`). `package-lock.json` may need a clean CI install refresh.  
   **Mitigation:** Re-run lockfile update in an environment with Python/node-gyp.

5. **`.openai/hosting.json` `d1: "DB"`**  
   Changed from `null` to enable local D1 binding for playable sessions.  
   **Mitigation:** Confirm hosting control-plane expectations before production deploy.

6. **Intent-to-add / large review patch**  
   Review patch includes screenshots and full client tree (~7MB). Reviewers should use FILE_LIST + focused diffs.

## Explicit non-goals (not done)

- Commit / merge / push
- Production auth
- REAL money enablement
- Changing frozen paytable / RTP / migrations SQL files

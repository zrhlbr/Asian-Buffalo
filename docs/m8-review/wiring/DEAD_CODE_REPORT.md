# DEAD CODE / ISLAND REPORT

| Island | Location | Production path? | Action |
|---|---|---|---|
| `MockProvider` + client RNG | `client/m5/mock-provider.ts` | **No** — boot imports FormalGameProvider only | Kept for isolated QA; tests assert not on boot |
| `createDemoGrid` / `evaluateSpin` | `lib/game-engine.ts` | **No** — formal path uses server-game-engine | Legacy; not removed (still referenced by unit tests/docs) |
| `routeTestWalletAdapter` | `lib/route-test-services.ts` | **Removed from** spin/balance routes | Retained for unit/doc compatibility; live routes use D1 |
| `RealWalletAdapter` | `lib/db-wallet-adapter.ts` | Always deny | Intentional fail-closed skeleton |
| `window.__game` | `client/m5/boot.ts` | Only when `allowDebugHooks()` (DEV / test identity) | Gated |
| Kimi demo client snapshot | `docs/m6-handoff/kimi-readonly/**` | Not mounted | Docs only |
| examples/d1 notes API | `examples/d1/**` | Not production game | Example |
| Admin `logs/game` UI | API exists, no module tab | Partial island | Documented FAIL in matrix |
| Hardcoded admin `admin`/`admin123` | bootstrap when test identity | Dev only | Fail-closed without env |

No hardcoded production player tokens found on formal boot path.

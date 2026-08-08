# TECH_DEBT_CLASSIFICATION (A–E)

| ID | Item | Class | Notes / action |
|----|------|-------|----------------|
| TD-01 | Windows `bash` / `pipefail` for `npm test` / `lint` / `build` | **B** (tooling) | **Mitigated:** `test:win`, `lint:win`, `build:win` added. Equivalents below. Do not dismiss real runtime errors as “baseline.” |
| TD-02 | `hosting.json` D1 binding `'DB' !== null` unit gate | **C** (known fail) | Pre-existing; 314/315 unit green. Classify as intentional env drift vs outdated test — **do not** silently ignore if deploy depends on null. |
| TD-03 | `tsc --noEmit` errors (`cloudflare:workers`, vinext config, examples/) | **C** | Pre-existing ambient types; not introduced by RC whitelist. Exit 2. |
| TD-04 | Full-repo `eslint` 20 errors in docs probes / legacy admin typing | **D** | Scoped lint on RC touched sources = **0**. Repo-wide lint exit 1. |
| TD-05 | worker-vite / vinext route classification warnings | **D** | Build succeeds (`build:win` exit 0); dynamic API routes flagged “Unknown”. |
| TD-06 | Real-device FPS lab missing | **A** (acceptance) | Blocks commercial FPS claims — see REAL_DEVICE_REPORT. |
| TD-07 | BR-005..009 unfrozen | **A** (business) | Money Gate Pending — see BR_005_009_FINAL_STATUS. |
| TD-08 | M9 parallel dirty tree | **B** | Players fix hash-synced; avoid dual-write drift. |
| TD-09 | Rankings in-process cache (single isolate) | **E** | Acceptable for RC; multi-isolate edge may briefly diverge. |

## Classes

- **A** — Blocks production money / commercial FPS acceptance  
- **B** — Tooling / process debt with workaround  
- **C** — Known failing gate; document exit codes  
- **D** — Noise / non-blocking warnings  
- **E** — Acceptable RC limitations  

## Windows reproducible commands (exit codes recorded this run)

```text
npm run test:unit     → exit 1   (314 pass / 1 fail hosting.json)
npm run test:win      → same as test:unit
npm run lint:win      → exit 1   (repo-wide; scoped RC files exit 0)
npm run build:win     → exit 0   (vinext build; rankings route present)
npx tsc --noEmit      → exit 2   (pre-existing ambient / examples)
git diff --check      → exit 0
```

Bash originals (`npm test`, `npm run lint`, `npm run build`) still require Git Bash / WSL `pipefail` environment — prefer `*:win` on native PowerShell.

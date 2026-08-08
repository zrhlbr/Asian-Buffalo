# RISK_REPORT — Integrated RC

| Risk | Level | Mitigation |
|------|-------|------------|
| Parallel write M8 ↔ M9 worktrees | HIGH | Edits only on M8; snapshot documents risk |
| Claiming production money ready | HIGH | BR docs + readiness banner + ACCEPTANCE_NOTE |
| `/` redirect surprises old demos | MED | Documented compat; lobby at `/xi` |
| Admin players live 500 | MED | Honest matrix gap; unit still green |
| Windows build/lint scripts | MED | Use `test:unit`; document BLOCKED |
| Dirty tree secrets (`.dev.vars`) | MED | Do not commit/push |
| Rankings incomplete | LOW | Explicit UI✅API❌ incomplete |

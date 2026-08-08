# ROLLBACK — XI GAME V2 Phase 1

## Instant rollback (delete additive surfaces)

Remove only Phase 1 paths (slot at `/` remains):

```text
app/xi/
app/game/
app/api/v1/lobby/
client/xi-lobby/
lib/lobby-catalog.ts
tests/xi-lobby-phase1.test.mjs
docs/m8-review/xi-game-v2/phase-1/   (optional docs keep)
```

No migration / DB schema changes were introduced by Phase 1 catalog seed.

## Verify after rollback

1. `/` still boots GameClient (`#gl` present)
2. `/xi` 404 expected
3. P0 stacking CSS untouched
4. Spin / wallet / ledger paths unchanged

## Note

No commit/push/deploy was performed in this delivery; rollback is filesystem delete of untracked Phase 1 files (or discard if later committed).
